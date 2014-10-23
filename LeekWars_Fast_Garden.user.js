// ==UserScript==
// @name        LeekWars Fast Garden
// @namespace   LeekWars.Garden
// @description Pour une gestion plus rapide des combats dans le potager.
// @include     http://leekwars.com/garden
// @include     http://leekwars.com/index.php?page=garden
// @downloadURL https://github.com/Foudge/LeekWars_Fast_Garden/raw/dev/LeekWars_Fast_Garden.user.js
// @updateURL   https://github.com/Foudge/LeekWars_Fast_Garden/raw/dev/LeekWars_Fast_Garden.user.js
// @version     0.0.3
// @grant       none
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

/* Override submitForm function */
window.submitForm = function(page, params){
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
  realParams.token = __TOKEN;
  var myId = realParams.leek_id || realParams.my_team || __FARMER_ID;
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
    console.log(targetName + ': ' + (success ? 'SUCCESS' : 'FAILED'));
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
        submitForm("garden_update", [
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
        submitForm("garden_update", [
          ['target_farmer', $(this).attr('id')]
        ]);
      });
    }
    else if (fightType == FightTypeEnum.TEAM) {
      $("div.enemies-compos[compo='" + myId + "']").find(".enemyCompo").remove();
      $("div.enemies-compos[compo='" + myId + "']").prepend($(response).find("div.enemies-compos[compo='" + myId + "']").children());
      // Click d'une compo adverse
      $('.enemyCompo').click(function() {
        submitForm("garden_update", [
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
  $.ajax({
        url: '/report/' + fight.fightId,
        type: 'GET',
        dataType: 'html',
        async: true,
        success: function(res) {
          if (fight.result != ResultEnum.UNDEFINED) {
            console.log("Combat déjà traité");
            return;
          }
          if (res.indexOf("Le combat n'est pas encore") != - 1) {
            console.log("Combat en cours de génération...");
            return;
          }
          var $res = $(res);
          var duration = $res.find("#duration").text();
          console.log(duration);
          var el = $("div.enemies[leek='" + fight.myId + "']");
          var i1 = res.indexOf("<h3>Gagnants</h3>");
          var i2 = res.indexOf("<h3>Perdants</h3>");
          if (i1 == -1 || i2 == -1) {
            console.log("Egalité !");
            fight.result = ResultEnum.EQUALITY;
            addFightResult(el, fight, duration);
            return;
          }
          var index = -1;
          if (fight.type == FightTypeEnum.SOLO)
            index = res.indexOf("<a href='/leek/" + fight.myId, i1);
          else if (fight.type == FightTypeEnum.FARMER)
            index = res.indexOf("<a href='/leek/" + myFirstLeekId, i1);
          else if (fight.type == FightTypeEnum.TEAM)
            index = res.indexOf("<a href='/team/" + myTeamId, i1);
          if (index == -1) {
            console.log("Echec de l'analyse du rapport de combat");
            return;
          }
          if (index < i2) {
            console.log("Victoire !");
            fight.result = ResultEnum.VICTORY;
          } else {
            console.log("Défaite !");
            fight.result = ResultEnum.DEFEAT;
          }
          var talent, xp, habs;
          if (fight.type == FightTypeEnum.SOLO) {
            if (fight.result == ResultEnum.VICTORY) {
              xp = $res.find(".xp").first().find("span").text();
              talent = $res.find(".talent").first().text();
              habs = $res.find(".money").first().find("span").first().text();
            } else {
              xp = $res.find(".xp").last().find("span").text();
              talent = $res.find(".talent").last().text();
              habs = $res.find(".money").last().find("span").first().text();
            }
            console.log("Talent :" + talent);
            console.log("XP : " + xp);
            console.log("Habs : " + habs);
          }
          addFightResult(el, fight, duration, talent, xp, habs);
        }
  });
}

function addFightResult(el, fight, duration, talent, xp, habs)
{
  if (fight.result == ResultEnum.UNDEFINED) return;
  var class_name = "fight-history";
  if (fight.result == ResultEnum.VICTORY) class_name = class_name + " win";
  else if (fight.result == ResultEnum.DEFEAT) class_name = class_name + " defeat";
  else if (fight.result == ResultEnum.EQUALITY) class_name = class_name + " draw";
  var $fightDiv = $("<div>", {class: class_name});
  var $fightImg = $("<img>", {src: "http://static.leekwars.com/image/fight_black.png"});
  var $fightLink = $("<a>", {href: "/report/" + fight.fightId});
  var $enemyLink = $("<a>", {href: "/leek/" + fight.targetId, text: " " + fight.targetName });
  $fightLink.append($fightImg);
  $fightDiv.append($fightLink);
  $fightDiv.append($enemyLink);
  var fight_title = duration;
  if (talent != undefined) fight_title += ("\nTalent :" + talent);
  if (xp != undefined) fight_title += ("\nXP : " + xp);
  if (habs != undefined) fight_title += ("\nHabs : " + habs);
  $fightDiv.prop('title', fight_title);
  if (fight.type == FightTypeEnum.SOLO) $("div.enemies[leek='" + fight.myId + "']").append($fightDiv);
  else if (fight.type == FightTypeEnum.FARMER) $("#farmers").append($fightDiv);
  else if (fight.type == FightTypeEnum.TEAM) $("div.enemies-compos[compo='" + fight.myId + "']").append($fightDiv);
}

function checkFights()
{
  for (var i=0; i<fights.length; i++) {
    if (fights[i].result == ResultEnum.UNDEFINED)
      checkFightResult(fights[i]);
  }
}

var FightTypeEnum = { UNDEFINED:0, SOLO:1, FARMER:2, TEAM:3 };
var ResultEnum = { UNDEFINED:0, EQUALITY:1, VICTORY:2, DEFEAT:3 };
var fights = [];
var myFirstLeekId = 0;
var myTeamId = 0;
var loading = false;

//wait page loaded
window.addEventListener('load', function () {
  //hide footer to maximize garden size
  var footer = document.getElementById('footer');
  footer.setAttribute('style', 'display: none;');
  document.getElementById('page').style.setProperty('height', window.innerHeight - 150 + 'px', null);
  document.getElementById('wrapper').setAttribute('style', 'max-width: 1100px');
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
  // remplace les avatars manquant par celui par défaut
  var images = document.getElementById('garden-right').getElementsByTagName('img');
  for(var i=0; i<images.length; i++) {
    if (images[i].src.indexOf("no_avatar.png") != -1) {
      console.log("avatar=" + images[i].src);
      images[i].src = "http://i2.wp.com/static.leekwars.com/image/no_avatar.png";
    }
  }
  //lancement du timer de révifications des combats
  setInterval(function(){checkFights()}, 3000);
}, false);
