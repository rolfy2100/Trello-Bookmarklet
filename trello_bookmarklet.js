(function (window) {

  let ISSUE_STATES_CERRADOS = [
    {estado: "CERRADO", id: "6"},
    {estado: "RESUELTO", id: "10024"},
    {estado: "CANCELADA_POR_QA", id: "10027"},
    {estado: "FINALIZADA", id: "10028"},
    {estado: "RECHAZADA", id: "10029"},
    {estado: "CERRADO_SIN_CORREGIR", id: "10035"},
    {estado: "RESUELTA", id: "10045"},
    {estado: "CANCELADO", id: "10047"},
    {estado: "FINALIZADO", id: "10049"},
    {estado: "CANCELADA", id: "10053"},
    {estado: "IMPLEMENTADO", id: "10252"}
  ];

  

  let SALTO_DE_LINEA = " \r\n\r\n \r\n\r\n ";
  let ITEM_LISTA = "- ";
  let ISSUE_TYPES_UTILIZADOS = ["Incidente de Test", "Tarea"];
  let tipoSincronizacion;
  var $;


  // Run several asyncronous functions in order
  var waterfall = function (fxs) {
    var runNext = function () {
      if (fxs.length) {
        fxs.shift().apply(null, Array.prototype.slice.call(arguments).concat([runNext]))
      }
    }
    runNext();
  }

  var storage = window.localStorage;
  if (!storage) {
    return;
  }

  // Store/retrieve a value from local storage
  var store = function (key, value) {
    if (arguments.length == 2) {
      return (storage[key] = value);
    } else {
      return storage[key];
    }
  };

  // The ids of values we keep in localStorage
  var appKeyName = "trelloAppKey";
  var idListName = "trelloIdList";
  var optAsk = "askMeEveryTime";
  //option value
  var optAskValue = parseInt(store(optAsk)) || 0;


  /* This is run after we've connected to Trello and selected a list */
  var run = function (boardSeleccionado, issuesPadres) {
    if (tipoSincronizacion === "masivo") {

      $.when(Trello.get("boards/" + boardSeleccionado.idBoard + "/cards"),
        jiraService
        .getAllIssuesActivesOfParents($("#project-name-val").text(),
          issuesPadres,
          ISSUE_TYPES_UTILIZADOS,
          ISSUE_STATES_CERRADOS)
      ).done(function (cardsExistentes, issues) {
        var peticionesObtenerIssuesPorId = [];
        $.each(issues[0].issues, function (index, issue) {
          peticionesObtenerIssuesPorId.push(jiraService.getIssue(issue.id));
        })
        $.when(...peticionesObtenerIssuesPorId).then(function () {
          var issues = obtenerIssuesDeRespuestaPromise(arguments);
          var issuesACrear = obtenerIssuesNoExistentesEnTrello(issues, cardsExistentes[0]);
          var cards = armarCards(issuesACrear);
          $.each(cards, function (index, card) {
            crearCardEnTrello(boardSeleccionado.idList, card);
          });
        });
      })

    } else {
      cargarCardIndividual(boardSeleccionado.idList);
    }
  }

  function obtenerIssuesDeRespuestaPromise(respuestPromise) {
    var issues = [];
    $.each(respuestPromise, function (index, promise) {
      issues.push(promise[0]);
    })
    return issues;
  }

  waterfall([
    // Get the user's App Key, either from local storage, or by prompting them to retrieve it
    function (next) {
      $ = window.jQuery;

      var appKey = store(appKeyName) || window[appKeyName];
      if (appKey && appKey.length == 32) {
        next(appKey);
      } else {
        overlayPrompt("Please specify your Trello API Key (you'll only need to do this once per site)<br><br>You can get your API Key <a href='https://trello.com/1/appKey/generate' target='apikey'>here</a><br><br>", true, function (newAppKey) {
          if (newAppKey) {
            next(newAppKey);
          }
        })
      }
    },
    // Load the Trello script
    function (appKey, next) {
      $.getScript("https://trello.com/1/client.js?key=" + appKey, next);
    },
    // Authorize our application
    function (a, b, c, next) {
      store(appKeyName, Trello.key())
      Trello.authorize({
        interactive: false,
        success: next,
        error: function () {
          overlayPrompt("You need to authorize Trello", false, function () {
            Trello.authorize({
              type: "popup",
              expiration: "never",
              scope: {
                read: true,
                write: true
              },
              success: next
            });
          });
        }
      });
    },
    // Get the list to add cards to, either from local storage or by prompting the user
    function elegirTableroYColumnaDeTrello(next) {
      var boardSeleccionado = store(idListName) || window[idListName];
      if (!optAskValue && boardSeleccionado && boardSeleccionado.length == 24) {
        next(boardSeleccionado);
      } else {
        Trello.get("members/me/boards", {
          fields: "name"
        }, function (boards) {
          $prompt = overlayPrompt('Which list should cards be sent to?<hr><div class="boards" style="overflow-y:scroll;max-height: 300px;"></div>', false, function (signal) {
            // signal: make sure that user didn't click the background layer to cancel this operation
            if (signal !== 0) {
              boardSeleccionado = {
                idList: $prompt.find("input[name=idList]:checked").attr("data-idList"),
                idBoard: $prompt.find("input[name=idList]:checked").attr("data-idBoard")
              };
              optAskValue = $prompt.find("input[name=" + optAsk + "]").is(':checked') ? 1 : 0;
              next(boardSeleccionado);
            }
          });

          $.each(boards, function (ix, board) {
            $board = $("<div>").appendTo($prompt.find(".boards"))

            Trello.get("boards/" + board.id + "/lists", function (lists) {
              $.each(lists, function (ix, list) {
                var $div = $("<div>").appendTo($board);
                var id_list = list.id;
                var $inputRadio = $("<input type='radio'" + (id_list == boardSeleccionado ? ' checked' : '') + ">");
                $inputRadio.attr("name", "idList");
                $inputRadio.attr("data-idBoard", board.id);
                $inputRadio.attr("data-idList", id_list);
                $("<label>").text(' ' + board.name + " : " + list.name).attr("for", id_list)
                  .appendTo($div)
                  .prepend($inputRadio);
              });
            })
          });

          var $opts = $('<div>').appendTo($prompt.find('.boards').append('<hr>'));
          $(".boards").after($('<input type="checkbox"' + (optAskValue ? ' checked ' : ' ') + 'id="input_' + optAsk + '" name="' + optAsk + '" value="1">'));
          $(".boards").after($('<label>').text(' Ask me every time').attr('for', 'input_' + optAsk));
        });
      }
    },
    // Store the idList for later
    function (boardSeleccionado, next) {
      if (boardSeleccionado) {
        store(idListName, boardSeleccionado);
        store(optAsk, optAskValue);
        next(boardSeleccionado, next);
      }
    },
    function elegirTipoSincronizacion(boardSeleccionado, next) {
      tipoSincronizacion;
      $prompt = overlayPrompt('Elegir tipo de carga<hr><div class="tipo-carga" style="overflow-y:scroll;max-height: 300px;"></div>', false,
        function (signal) {
          if (signal !== 0) {
            tipoSincronizacion = $prompt.find("input[type=radio]:checked").attr("id");
            next(boardSeleccionado, tipoSincronizacion);
          }
        });

      $("<label>").text('Masivo')
        .attr("for", 'masivo')
        .appendTo($prompt)
        .prepend($("<input type='radio'>")
          .attr("id", "masivo").attr("name", "tipoCarga"));

      $("<label>").text('Individual')
        .attr("for", "individual")
        .appendTo($prompt)
        .prepend($("<input type='radio'>")
          .attr("id", "individual").attr("name", "tipoCarga"));
    },
    function elegirIssuesPadres(boardSeleccionado, tipoSincronizacion, next) {
      var issuesPadres = [];
      if (tipoSincronizacion === "masivo") {
        var nombreProyecto = $("#project-name-val").text();
        $prompt = overlayPrompt('Elegi cuales issues quieres sincronizar<hr><div class="boards" style="overflow-y:scroll;max-height: 300px;"></div>', false, function (signal) {
          // signal: make sure that user didn't click the background layer to cancel this operation
          if (signal !== 0) {
            $.each($prompt.find("input[name=issuesPadres]:checked"), function (index, issue) {
              issuesPadres.push(issue.id);
            })
            next(boardSeleccionado, issuesPadres, next);
          }
        });
        jiraService.getIssuesPadresDeProyecto(nombreProyecto).success(function (response) {

          $board = $("<div>").appendTo($prompt.find(".boards"))
          $.each(response.issues, function (ix, issue) {
            var $div = $("<div>").appendTo($board);
            $("<label>").text(issue.key).attr("for", issue.key)
              .appendTo($div)
              .prepend($("<input type='checkbox'>")
                .attr("id", issue.key)
                .attr("name", "issuesPadres"));
          });
        });
      } else {
        next(boardSeleccionado, issuesPadres);
      }
    },
    // Run the user portion
    run
  ]);

  function obtenerIssuesNoExistentesEnTrello(issues, cardsExistentes) {
    var issuesNoExistentesEnTrello = [];
    $.each(issues, function (index, issue) {
      if (!esCardExistente(issue, cardsExistentes)) {
        issuesNoExistentesEnTrello.push(issue);
      }
    });
    return issuesNoExistentesEnTrello;
  }

  function esCardExistente(issue, cardsExistentes) {
    var esCardExistente = false;
    $.each(cardsExistentes, function (index, card) {
      var keyCard = card.name.substr(0, card.name.indexOf(":"));
      if (keyCard === issue.key) {
        esCardExistente = true;
        return;
      };
    });
    return esCardExistente;
  }

  function armarCards(issues) {
    var cards = [];
    $.each(issues, function (index, issue) {
      var card = {
        description: armarDescripcionParaJira(issue),
        name: armarNameJira(issue.key, issue.fields.summary)
      }
      cards.push(card);
    });
    return cards;
  }

  function armarDescripcionParaJira(issue) {
    let adjuntos = armarRecursosAdjuntos(issue);
    return issue.fields.description + " " + adjuntos;
  }

  function armarRecursosAdjuntos(issue) {
    var tituloSeccionAdjunto = SALTO_DE_LINEA + "*Adjuntos*" + SALTO_DE_LINEA;
    var fechaCreacionIssue = new Date(issue.fields.created);
    var fechaCreacionAdjunto;
    $.each(issue.fields.attachment, function (index, adjunto) {
      fechaCreacionAdjunto = new Date(adjunto.created);
      var esAdjuntoDeIssue = fechasConMismoDiaDeCreacion(fechaCreacionAdjunto, fechaCreacionIssue);
      if (esAdjuntoDeIssue) {
        tituloSeccionAdjunto = tituloSeccionAdjunto + ITEM_LISTA + adjunto.content + SALTO_DE_LINEA;
      }
    });
    return tituloSeccionAdjunto;
  }

  function fechasConMismoDiaDeCreacion(fechaCreacionAdjunto, fechaCreacionIssue) {
    return fechaCreacionAdjunto.getFullYear() === fechaCreacionIssue.getFullYear() &&
      fechaCreacionAdjunto.getMonth() === fechaCreacionIssue.getMonth() &&
      fechaCreacionAdjunto.getDate() === fechaCreacionIssue.getDate();
  }

  function cargarCardIndividual(idList) {
    var card = armarCard();
    // Create the card
    if (card.name) {
      if (card.esJira) {
        jiraService.getIssue($("#key-val").prop('rel')).success(function (response) {
          if (esIssueValido(response)) {
            card.description = armarDescripcionParaJira(response);
            crearCardEnTrello(idList, card);
          } else {
            alert("No se puede agregar, ya que el issue esta cerrado");
            recargarPagina();
          }
        })
      } else {
        crearCardEnTrello(idList, card);
      }
    }
  }

  function armarCard() {
    // Default description is the URL of the page we're looking at
    var name;
    var desc = location.href;
    var esJira = false;

    if (window.goBug) {

      // We're looking at a FogBugz case
      name = goBug.ixBug + ": " + goBug.sTitle

    } else if (desc.match(/salesforce.com\/500/)) {
      name = 'Case:' + $('h2.pageDescription').text().trim() + ' ' + $('td:contains(Subject)').closest('td').next().text().trim();

      if ($('span.listTitle:contains(Case Comments[0])').length != 1) {
        desc = $('td.dataCell').eq(0).text().trim() + '\n\n\n' + location.href;
      } else {
        desc = $('td:contains(Description)').closest('td').next().text().trim() + '\n\n\n' + location.href;
      }

    } else if ($('span.ticket-number').length && $('div.ticket-summary h1').length) {

      // we're looking at an Assembla ticket
      name = $('span.ticket-number').text().trim() + ' ' + $('div.ticket-summary h1').text().trim();

    } else if ($("#issue_header_summary").length) {

      // We're looking at a JIRA case in an older JIRA installation
      name = $("#key-val").text() + ": " + $("#issue_header_summary").text();

    } else if ($("#jira").length) {

      // We're looking at a 5.1+ JIRA case
      name = armarNameJira($("#key-val").text(), $("#summary-val").text());
      esJira = true;
    } else if ($("#show_issue").length) {

      // We're looking at a GitHub issue
      name = $("#show_issue .number strong").text() + " " + $("#show_issue .discussion-topic-title").text();

    } else if ($("#all_commit_comments").length) {

      // We're looking at a GitHub commit
      name = $(".js-current-repository").text().trim() + ": " + $(".commit .commit-title").text().trim();

    } else if (jQuery('head meta[content=Redmine]').length) {

      // We're looking at a redmine issue
      name = $("#content h2:first").text().trim() + ": " + $("#content h3:first").text().trim();

    } else if ($('#header h1').length) {

      // We're looking at a RequestTracker (RT) ticket
      name = $('#header h1').text().trim();

    } else if ($('h1 .hP').length) {

      // we're looking at an email in Gmail
      name = $('h1 .hP').text().trim();

    } else {
      // use page title as card title, taking trello as a "read-later" tool
      name = $.trim(document.title);

    }

    // Get any selected text
    var selection;

    if (window.getSelection) {
      selection = "" + window.getSelection();
    } else if (document.selection && document.selection.createRange) {
      selection = document.selection.createRange().text;
    }

    if (!selection && $('.gs .adP').length) {

      // we're looking at an email in Gmail
      selection = $('.gs .adP').eq(0).html();
      selection = selection.replace(/(<br\s*[/]?>|<\/p>|<\/div>|<\/tr>|<\/blockquote>)/gi, '\n$1');
      selection = $(selection).text();
      //deal with multiple empty lines
      selection = selection.replace(/\s*\n\s*\n/g, '\n\n');
      selection = selection.replace(/\n\s{2,}(\S)/g, '\n  $1');
      // avoid markdown parsing by trello
      selection = selection.replace(/--/g, '-- ');
      if (selection) {
        selection = '------ original content ------\n\n' + selection;
      }

    }


    // If they've selected text, add it to the name/desc of the card
    if (selection) {
      if (!name) {
        name = selection;
      } else {
        desc += "\n\n" + selection;
      }
    }

    name = name || 'Unknown page';

    return {
      name: name,
      description: desc,
      esJira: esJira
    };
  }

  function armarNameJira(key, summary) {
    return key + ": " + summary;
  }

  function crearCardEnTrello(idList, card) {
    Trello.post("lists/" + idList + "/cards", {
      name: card.name,
      desc: card.description
    }, function (card) {
      alert("Carga realizada");
      recargarPagina();
    })
  }

  function esIssueValido(issue) {
    var esIssueValido = true;
    $.each(ISSUE_STATES_CERRADOS, function (clave, valor) {
      if (valor === issue.fields.status.id) {
        esIssueValido = false;
        return;
      }
    });
    return esIssueValido;
  }

  function recargarPagina() {
    window.location = window.location.href;
  }

  // A fake "prompt" to get info from the user
  var overlayPrompt = function (html, hasInput, callback) {
    var done = function (value) {
      $div.remove();
      $overlay.remove();
      callback(value);
    };

    // Cover the existing webpage with an overlay
    var $overlay = $("<div>")
      .css({
        background: "#000",
        opacity: .75,
        "z-index": 1e4,
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: "auto",
      })
      .appendTo("body")
      .click(function () {
        done(0);
      });

    // Show a "popup"
    var $div = $("<div>")
      .css({
        position: "absolute",
        border: "1px solid #000",
        padding: "16px",
        width: 300,
        top: 64,
        left: ($(window).width() - 200) / 2,
        background: "#fff",
        "z-index": 1e5
      })
      .appendTo("body");

    // Show the prompt
    $("<div>").html(html).appendTo($div);

    // Optionally show an input
    var $input = $("<input>")
      .css({
        width: "100%",
        "margin-top": "8px"
      })
      .appendTo($div)
      .toggle(hasInput);

    // Add an "OK" button
    $("<div>")
      .text("OK")
      .css({
        width: "100%",
        "text-align": "center",
        border: "1px solid #000",
        background: "#eee",
        "margin-top": "8px",
        cursor: "pointer"
      })
      .appendTo($div)
      .click(function () {
        done($input.val());
      });

    return $div;
  };
})(window);