(function (bodyPaginaActual) {


    if (paginaSinJquery(bodyPaginaActual)) {
        crearScript(bodyPaginaActual, "jquery.min.js", 'send_to_trello_local_jquery');
    }
    crearScript(bodyPaginaActual, "jquery.cookie.js", null);
    window.trelloAppKey = "optional";
    window.trelloIdList = "optional";

    crearScript(bodyPaginaActual, "jiraService.js", null);
    crearScript(bodyPaginaActual, "trello_bookmarklet.js", null);
})(document);

function crearScript(bodyPagina, urlJs, id) {
    var jqueryScript = bodyPagina.createElement("script");
    jqueryScript.id = id;
    jqueryScript.src = chrome.extension.getURL(urlJs);
    bodyPagina.getElementsByTagName("head")[0].appendChild(jqueryScript);
}

function paginaSinJquery(bodyPaginaActual) {
    return !bodyPaginaActual.getElementById('send_to_trello_local_jquery') && typeof window.$ === 'undefined' && typeof window.jQuery === 'undefined';
}