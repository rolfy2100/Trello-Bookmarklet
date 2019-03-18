var jiraService = (function (window) {
    let $ = window.jQuery;
    let jiraApi = {};

    jiraApi.getIssue = function (issueId) {
        return $.ajax({
            url: "http://jira.conexia.com.ar:8080/rest/api/2/issue/" + issueId + "?fields=summary,%20comment,description,status,attachment,created",
            beforedSend: agregarHeaders,
            type: "GET"
        });
    }

    jiraApi.getIssuesPadresDeProyecto = function (proyecto) {
        return $.ajax({
            url: "http://jira.conexia.com.ar:8080/rest/api/2/search?jql=project = " + proyecto + " AND issuetype in standardIssueTypes()",
            beforedSend: agregarHeaders,
            type: "GET"
        });
    }

    jiraApi.getAllIssuesActivesOfParents = function (proyecto, nombrePadres, tiposDeIssues) {
        return $.ajax({
            url: "http://jira.conexia.com.ar:8080/rest/api/2/search?jql=project = " + proyecto +
                " AND parent in (" + concatenarConComas(nombrePadres) + ")" +
                " AND resolution is empty AND issuetype IN (" + concatenarConComas(tiposDeIssues) + ")",
            beforedSend: agregarHeaders,
            type: "GET"
        });
    }

    function agregarHeaders(request) {
        request.setRequestHeader("Cookie", armarHeaderCookie());
    }

    function armarHeaderCookie() {
        var ajs = $.cookie("AJS.conglomerate.cookie");
        var jsession = $.cookie("JSESSIONID");
        var token = $.cookie("atlassian.xsrf.token");
        return ajs + "; " + jsession + "; " + token + ";";
    }

    function concatenarConComas(listaAConcatenar) {
        let listaConcatenada = "";
        $.each(listaAConcatenar, function (index, itemAConcatenar) {
            listaConcatenada = listaConcatenada + "'" + itemAConcatenar + "'";
            if(listaAConcatenar[index + 1]){
                listaConcatenada = listaConcatenada + ",";
            }
        });
        return listaConcatenada;
    }
    return jiraApi;
})(window);