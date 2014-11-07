// ==UserScript==
// @name        LeekWars Fast Garden
// @namespace   LeekWars.Garden
// @description Pour une gestion plus rapide des combats dans le potager.
// @include     http://leekwars.com/garden
// @include     http://leekwars.com/index.php?page=garden
// @downloadURL https://github.com/Foudge/LeekWars_Fast_Garden/raw/dev/LeekWars_Fast_Garden.user.js
// @updateURL   https://github.com/Foudge/LeekWars_Fast_Garden/raw/dev/LeekWars_Fast_Garden.user.js
// @version     0.0.9
// @grant       GM_getValue
// @grant       GM_setValue
// @require     http://code.jquery.com/jquery-2.1.1.min.js
// ==/UserScript==


function getTitle(html) {
  var el = document.createElement('div');
  el.innerHTML = html;
  return el.getElementsByTagName('title')[0].text;
}

function getName(id) {
  return $('#' + id).html().match(/[<]{1}br>([^<]*)[<]{1}br>/)[1];
}

function decCount(id) {
  var counter = $('#'+id+' .fights');
  var count = counter.text().match(/[0-9-]+/)[0];
  counter[0].lastChild.nodeValue = ' ' + (count-1);
}

function replaceSubmitForm()
{
  console.log('replaceSubmitForm');
  var $unsafe_garden = unsafeWindow.$("#garden-right");
  var $garden = window.$("#garden-right");
  // Click d'un adversaire
  $unsafe_garden.find(".leek.enemy").unbind("click");
  $garden.find(".leek.enemy").click(function() {
    mySubmitForm("garden_update", [
      ['leek_id', $(this).parent().attr('leek')],
      ['enemy_id', $(this).attr('id')]
    ]);
  });
  // Click d'un farmer
  $unsafe_garden.find(".enemy.farmer").unbind("click");
  $garden.find('.enemy.farmer').click(function() {
    mySubmitForm("garden_update", [
      ['target_farmer', $(this).attr('id')]
    ]);
  });
  // Click d'une compo adverse
  $unsafe_garden.find(".enemyCompo").unbind("click");
  $garden.find('.enemyCompo').click(function() {
    mySubmitForm("garden_update", [
      ['my_team', $(this).parent().attr('compo')],
      ['target_team', $(this).attr('id')]
    ]);
  });
}

// My submitForm function
function mySubmitForm(page, params){
  //demande annulé si combat en cours ou potager en cours de rechargement
  if (loading == true) {
    console.log('Combat en cours...');
    return;
  }
  //récupération des paramètres
  var realParams = {};
  for (var p in params) {
    realParams[params[p][0]] = params[p][1];
    console.log(params[p][0] + '=' + params[p][1]);
  }
  realParams.token = unsafeWindow.__TOKEN;
  var myId = realParams.leek_id || realParams.my_team || unsafeWindow.__FARMER_ID;
  var targetId = realParams.enemy_id || realParams.target_team || realParams.target_farmer;
  var targetName = getName(targetId);
  var fightType = FightTypeEnum.UNDEFINED;
  if (!!realParams.enemy_id) fightType = FightTypeEnum.SOLO;
  if (!!realParams.target_farmer) fightType = FightTypeEnum.FARMER;
  if (!!realParams.target_team) fightType = FightTypeEnum.TEAM;
  if (fightType == FightTypeEnum.UNDEFINED) {
    console.log('Combat annulé car de type inconnu');
    return;
  }
  console.log('Lancement du combat contre ' + targetName + '...');
  loading = true;
  //petit changement d'apparence pour indiquer qu'un combat est lancé
  $('#' + targetId).css({ backgroundColor: "white", border: "1px dashed black" });
  if (fightType == FightTypeEnum.SOLO) $("div.enemies[leek='" + myId + "']").find(".leek.enemy").not('#' + targetId).css({ opacity: 0.3 });
  else if (fightType == FightTypeEnum.FARMER) $("#farmers").find(".enemy.farmer").not('#' + targetId).css({ opacity: 0.3 });
  else if (fightType == FightTypeEnum.TEAM) $("div.enemies-compos[compo='" + myId + "']").find(".enemyCompo").css({ opacity: 0.3 });
  $.post('/' + page, realParams, function (response) {
    var success = getTitle(response).toLowerCase().indexOf('combat') != - 1;
    console.log(success ? "Combat lancé avec succès !" : "Combat rejeté par le matchmaker !");
    if (success) {
      if (fightType == FightTypeEnum.SOLO) decCount('tab-solo');
      else if (fightType == FightTypeEnum.FARMER) decCount('tab-farmer');
      else if (fightType == FightTypeEnum.TEAM) decCount('tab-team');
      if (fightType != FightTypeEnum.FARMER) decCount(myId);
      //récupération du fight id
      //j'suis sûr qu'il y a un moyen simple&propre de récupérer __ID !!!
      var i1 = response.indexOf("<script>var __ID");
      var i2 = response.indexOf("<\/script>", i1);
      var fightId = response.substring(i1+19, i2);
      console.log('fightId=' + fightId);
      var fight = { 'targetId':targetId, 'targetName':targetName, 'fightId':fightId, 'myId':myId, 'type':fightType, 'result':ResultEnum.UNDEFINED };
      addFightResult(fight);
      fights.push(fight);
    } else {
      console.log('Adversaire ' + name + ' retiré de la liste car plus proposé dans le potager');
      var el = $('#' + targetId);
      if (el) el.css({ opacity: 0.3 });
    }
    console.log("Rechargement du potager...");
    reloadGarden(myId, fightType);
  });
}

function reloadGarden(myId, fightType)
{
  $.get('/garden',  function (response) {
    if (fightType == FightTypeEnum.SOLO) {
      $("div.enemies[leek='" + myId + "']").find(".leek.enemy").remove();
      $("div.enemies[leek='" + myId + "']").prepend($(response).find("div.enemies[leek='" + myId + "']").children());
      // Click d'un adversaire
      $(".leek.enemy").click(function() {
        mySubmitForm("garden_update", [
          ['leek_id', myId],
          ['enemy_id', $(this).attr('id')]
        ]);
      });
    }
    else if (fightType == FightTypeEnum.FARMER) {
      $("#farmers").find(".enemy.farmer").remove();
      $("#farmers").prepend($(response).find("#farmers").children());
      // Click d'un farmer
      $('.enemy.farmer').click(function() {
        mySubmitForm("garden_update", [
          ['target_farmer', $(this).attr('id')]
        ]);
      });
    }
    else if (fightType == FightTypeEnum.TEAM) {
      $("div.enemies-compos[compo='" + myId + "']").find(".enemyCompo").remove();
      $("div.enemies-compos[compo='" + myId + "']").prepend($(response).find("div.enemies-compos[compo='" + myId + "']").children());
      // Click d'une compo adverse
      $('.enemyCompo').click(function() {
        mySubmitForm("garden_update", [
          ['my_team', myId],
          ['target_team', $(this).attr('id')]
        ]);
      });
    }
    loading = false;
    console.log('Potager rechargé');
  });
}

function checkFightResult(fight)
{
  $.get('/report/' + fight.fightId, function (res) {
    if (fight.result != ResultEnum.UNDEFINED && fight.result != ResultEnum.GENERATING) {
      console.log("Combat " + fight.fightId + " déjà traité");
      return;
    }
    console.log("Vérification du combat " + fight.fightId + " ...");
    if (res.indexOf("Le combat n'est pas encore") != - 1) {
      if (fight.result == ResultEnum.UNDEFINED) {
        console.log("Combat " + fight.fightId + " en cours de génération");
        fight.result = ResultEnum.GENERATING;
        addFightResult(fight);
      }
      return;
    }
    var i1 = res.indexOf("<h3>Gagnants</h3>");
    var i2 = res.indexOf("<h3>Perdants</h3>");
    if (i1 == -1 || i2 == -1) {
      console.log("Egalité !");
      fight.result = ResultEnum.DRAW;
    }
    if (fight.result != ResultEnum.DRAW) {
      var index = -1;
      if (fight.type == FightTypeEnum.SOLO)
        index = res.indexOf("<a href='/leek/" + fight.myId, i1);
      else if (fight.type == FightTypeEnum.FARMER)
        index = res.indexOf("<a href='/leek/" + myFirstLeekId, i1);
      else if (fight.type == FightTypeEnum.TEAM)
        index = res.indexOf("<a href='/team/" + myTeamId, i1);
      if (index == -1) {
        console.log("Echec de l'analyse du rapport du combat " + fight.fightId);
        return;
      }
      if (index < i2) {
        console.log("Victoire !");
        fight.result = ResultEnum.WIN;
      } else {
        console.log("Défaite !");
        fight.result = ResultEnum.DEFEAT;
      }
    }
    var $res = $(res);
    var duration = $res.find("#duration").text();
    console.log(duration);
    var talent, xp, habs, $stats;
    if (fight.type == FightTypeEnum.SOLO) {
      if (fight.result != ResultEnum.DEFEAT)
        $stats = $res.find(".report").first();
      else
        $stats = $res.find(".report").last();
      xp = $stats.find(".xp").find("span").text();
      talent = $stats.find(".talent").text();
      habs = $stats.find(".money").find("span").first().text();
    } else {
      if (fight.result != ResultEnum.DEFEAT)
        $stats = $res.find(".total").first();
      else
        $stats = $res.find(".total").last();
      xp = $stats.find(".xp").text();
      talent = $stats.find(".talent").text();
      habs = $stats.find(".money").find("span").first().text();
    }
    console.log("Talent :" + talent);
    console.log("XP : " + xp);
    console.log("Habs : " + habs);
    addFightResult(fight, duration, talent, xp, habs);
  });
}

function addFightResult(fight, duration, talent, xp, habs)
{
  var class_name = "fight-history";
  if (fight.result == ResultEnum.WIN) class_name += " win";
  else if (fight.result == ResultEnum.DEFEAT) class_name += " defeat";
  else if (fight.result == ResultEnum.DRAW) class_name += " draw";
  else class_name += " generating";
  var $fightDiv = $("#fight-" + fight.fightId);
  if ($fightDiv[0] == undefined) {
    $fightDiv = $("<div>", {class: class_name, id: ("fight-"+fight.fightId)});
    var $fightImg = $("<img>", {src: "http://static.leekwars.com/image/fight_black.png"});
    var fight_link = use_report_link ? ("/report/" + fight.fightId) : ("/fight/" + fight.fightId);
    var target_link = force_new_tab ? "_blank" : "_self";
    var $fightLink = $("<a>", {href: fight_link, target: target_link});
    var $enemyLink = $("<a>", {text: " " + fight.targetName, target: target_link});
    if (fight.type == FightTypeEnum.SOLO) $enemyLink.attr("href", "/leek/" + fight.targetId);
    else if (fight.type == FightTypeEnum.FARMER) $enemyLink.attr("href", "/farmer/" + fight.targetId);
    //else if (fight.type == FightTypeEnum.TEAM) $enemyLink.attr("href", "/team/" + fight.targetId); //le targetId est l'ID de composition et non de l'équipe!
    $fightLink.append($fightImg);
    $fightDiv.append($fightLink);
    $fightDiv.append($enemyLink);
    if (fight.type == FightTypeEnum.SOLO) $("div.enemies[leek='" + fight.myId + "']").append($fightDiv);
    else if (fight.type == FightTypeEnum.FARMER) $("#farmers").append($fightDiv);
    else if (fight.type == FightTypeEnum.TEAM) $("div.enemies-compos[compo='" + fight.myId + "']").append($fightDiv);
  } else {
    $fightDiv.attr('class', class_name);
  }
  if (show_tooltip) {
    if (fight.result == ResultEnum.UNDEFINED)
      $fightDiv.prop('title', "En attente d'analyse du résultat...");
    else if (fight.result == ResultEnum.GENERATING)
      $fightDiv.prop('title', "Combat en cours de génération...");
    else {
      var fight_title = duration;
      if (talent != undefined) fight_title += ("\nTalent :" + talent);
      if (xp != undefined) fight_title += ("\nXP : " + xp);
      if (habs != undefined) fight_title += ("\nHabs : " + habs);
      $fightDiv.prop('title', fight_title);
    }
  }
}

function checkFights()
{
  for (var i=0; i<fights.length; i++) {
    if (fights[i].result == ResultEnum.UNDEFINED || fights[i].result == ResultEnum.GENERATING)
      checkFightResult(fights[i]);
  }
}

function addSetupButton()
{
  var potager = document.getElementById("page").children[0];
  potager.style.display = "inline-block";
  var $setupDiv = $("<div>", {class: "button", style: "width: 24px; height: 24px; margin-left: 10px;"});
  var $setupImg = $("<img>", {src: "http://static.leekwars.com/image/engrenage_black.png", style: "width: 100%; height: 100%;"});
  $setupDiv.append($setupImg);
  $setupDiv.insertAfter(potager);
  $setupDiv.click(function(){$("#popups").css("display", "table");});
}

function createSetupPopup()
{
  var $setupDiv = $("<div>", {id: "setup-popup", class: "popup", style: "width: 600px; display: inline-block; opacity: 1;"});
  var content = "<div class='title'>Paramètres du potager</div>\
  <div class='content'>\
    <input id='setting-compact' type='checkbox'>\
    <label for='setting-compact'>Utiliser le mode compact (adapté aux faibles résolutions)</label><br>\
    <input id='setting-report-link' type='checkbox'>\
    <label for='setting-report-link'>Lien renvoyant vers le rapport de combat plutôt que sa visualisation</label><br>\
    <input id='setting-newtab-link' type='checkbox'>\
    <label for='setting-newtab-link'>Forcer l'ouverture du combat dans un nouvel onglet</label><br>\
    <input id='setting-tooltip' type='checkbox'>\
    <label for='setting-tooltip'>Afficher le résumé du combat dans une infobulle</label><br>\
    <input id='setting-fix-avatar' type='checkbox'>\
    <label for='setting-fix-avatar'>Corriger le problème d'affichage de l'avatar par défaut</label>\
  </div>\
  <div class='actions' style='display: flex;'>\
    <div id='setting-ok'>OK</div>\
    <div id='setting-cancel'>Annuler</div>\
	</div>"
  $setupDiv.append(content);
  if (compact_mode) $setupDiv.find("#setting-compact").prop('checked', true);
  if (use_report_link) $setupDiv.find("#setting-report-link").prop('checked', true);
  if (force_new_tab) $setupDiv.find("#setting-newtab-link").prop('checked', true);
  if (show_tooltip) $setupDiv.find("#setting-tooltip").prop('checked', true);
  if (fix_avatar) $setupDiv.find("#setting-fix-avatar").prop('checked', true);
  $setupDiv.find("#setting-ok").click(function(){saveSettingValues();$("#popups").css("display", "none");});
  $setupDiv.find("#setting-cancel").click(function(){$("#popups").css("display", "none");});
  $("#popups").find("td").append($setupDiv);
}

function loadSettingValues()
{
  compact_mode = GM_getValue("compact_mode", false);
  use_report_link = GM_getValue("use_report_link", true);
  force_new_tab = GM_getValue("force_new_tab", true);
  show_tooltip = GM_getValue("show_tooltip", true);
  fix_avatar = GM_getValue("fix_avatar", false);
}

function saveSettingValues()
{
  $setupDiv = $("div#setup-popup");
  if ($setupDiv.length != 0) {
    compact_mode = $setupDiv.find("#setting-compact").prop('checked');
    console.log("compact_mode=" + compact_mode);
    use_report_link = $setupDiv.find("#setting-report-link").prop('checked');
    console.log("use_report_link=" + use_report_link);
    force_new_tab = $setupDiv.find("#setting-newtab-link").prop('checked');
    console.log("force_new_tab=" + force_new_tab);
    show_tooltip = $setupDiv.find("#setting-tooltip").prop('checked');
    console.log("show_tooltip=" + show_tooltip);
    fix_avatar = $setupDiv.find("#setting-fix-avatar").prop('checked');
    console.log("fix_avatar=" + fix_avatar);
    GM_setValue("compact_mode", compact_mode);
    GM_setValue("use_report_link", use_report_link);
    GM_setValue("force_new_tab", force_new_tab);
    GM_setValue("show_tooltip", show_tooltip);
    GM_setValue("fix_avatar", fix_avatar);
  } else {
    console.log("setup-popup not found!");
  }  
}


var FightTypeEnum = { UNDEFINED:0, SOLO:1, FARMER:2, TEAM:3 };
var ResultEnum = { UNDEFINED:0, GENERATING:1, DRAW:2, WIN:3, DEFEAT:4 };
var fights = [];
var myFirstLeekId = 0;
var myTeamId = 0;
var loading = false;
var compact_mode, use_report_link, force_new_tab, show_tooltip, fix_avatar;

//wait page loaded
window.addEventListener('load', function () {
  //hide footer to maximize garden size
  var footer = document.getElementById('footer');
  footer.setAttribute('style', 'display: none;');
  document.getElementById('page').style.setProperty('height', window.innerHeight - 150 + 'px', null);
  document.getElementById('wrapper').setAttribute('style', 'max-width: 1100px');
  //add setup button
  addSetupButton();
  loadSettingValues();
  createSetupPopup();
  // récupération d'infos sur l'éleveur
  myFirstLeekId = $("div.leek.myleek").attr("id");
  console.log("myFirstLeekId=" + myFirstLeekId);
  var menu = document.getElementById('menu');
  var links = menu.getElementsByTagName('a');
  for(var i=0; i<links.length; i++) {
    var href = links[i].getAttribute('href');
    if (href.indexOf('/team/') != -1) {
      myTeamId = href.substr(6);
      console.log("myTeamId=" + myTeamId);
      break;
    }
  }
  // remplace submitForm par mySubmitForm
  replaceSubmitForm();
  // remplace les avatars manquant par celui par défaut
  if (fix_avatar) {
    var images = document.getElementById('garden-right').getElementsByTagName('img');
    for(var i=0; i<images.length; i++) {
      if (images[i].src.indexOf("no_avatar.png") != -1) {
        console.log("avatar=" + images[i].src);
        images[i].src = "http://i2.wp.com/static.leekwars.com/image/no_avatar.png";
      }
    }
  }
  //lancement du timer de révifications des combats
  setInterval(function(){checkFights()}, 3000);
}, false);
