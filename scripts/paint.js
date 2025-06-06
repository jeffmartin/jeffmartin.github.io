$(document).ready(function(){
var position = null;
autodraw = function(){
	toggleDrawOn();
	var canvas = document.getElementById("awesome");
		var time = new Date();
		var pos = {};
		var seconds = time.getSeconds();
		if (position === null){
		pos.x = time.getMilliseconds();
		pos.y = seconds;
		}
		else{
		pos = position;
		}
		var minutes = time.getMinutes();
		var brush = "line";
		var toggle = {r:0, g:0, b:0};
		if(minutes % 2 === 0){
			brush = "bezier";
		}
		if(minutes % 3 === 0){
			brush = "circle";
		}
		if(minutes % 5 === 0){
			brush = "square";
		}
		if(seconds > 10 && seconds < 30){
			toggle.r = 1;
		}
		if(seconds > 20 && seconds < 40){
			toggle.g = 1;
		}
		if(seconds > 25 && seconds < 60){
			toggle.b = 1;
		}
		var color = getRandomColor(toggle);
		if(shouldAutoDraw){
			position = draw(canvas, pos, brush, color);
			window.requestAnimationFrame(autodraw);
		}
}
mobileAndTabletCheck = function() {
  let check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
};
var isMobile = mobileAndTabletCheck();
	function getRandomColor(toggle) {
  	
		var r = toggle.r*Math.floor(Math.random() * 255),
    g = toggle.g*Math.floor(Math.random() * 255),
    b = toggle.b*Math.floor(Math.random() * 255),
    a = Math.random()
    return 'rgba('+r+','+g+','+b+','+a+')';
	}
  function clear() {
  	var canvas = document.getElementById("awesome");
    var context = canvas.getContext("2d");
    var w = canvas.width;
    var l = canvas.height;
    if($("#toggleBlackBG")[0].checked){
    	context.fillStyle = 'black';
    }
    else{
    context.fillStyle = 'white';
    }
    context.fillRect(0,0,w,l);
  }
  $('#toggleBlackBG').click(clear);
  function followMouse(evt){
  	if (!drawing) return;
  	var canvas = document.getElementById("awesome");
  	var pos = getMousePos(canvas, evt);
  	var brush = $('#brush').val();
  	var toggle = {
    	r: $('#toggleRed')[0].checked,
    	g: $('#toggleGreen')[0].checked,
    	b: $('#toggleBlue')[0].checked
    };
  	
  	var color = getRandomColor(toggle);
  	
  	draw(canvas, pos, brush, color);
  }
  function draw(canvas, pos, brush, color){  
    
    var context = canvas.getContext("2d");
      var randomX = Math.floor(Math.random() * canvas.width)
      var randomY = Math.floor(Math.random() * canvas.height)
context.beginPath();
			
      
      if(brush === "bezier"){
            context.moveTo(randomX,randomY);
            context.bezierCurveTo(Math.floor(Math.random() * canvas.width), Math.floor(Math.random() * canvas.height), Math.floor(Math.random() * canvas.width), Math.floor(Math.random() * canvas.height), pos.x, pos.y);
            
            }
      else if(brush === "line"){
      context.moveTo(randomX,randomY);
			context.lineTo(pos.x, pos.y);
      }
      else if(brush === "circle"){
      var wMin = (canvas.width/2) > randomX ? randomX : canvas.width - randomX,
			hMin = (canvas.height/2) > randomY ? randomY : canvas.height - randomY,
			maxRadius = Math.min(wMin, hMin);
      var radius = Math.floor(Math.random() * maxRadius);
      		context.arc(pos.x, pos.y, radius, 2*Math.PI, false);
          context.fillStyle = color;
          context.fill();
      }
      else if(brush === "square"){
              context.fillStyle = color;
              
      	context.fillRect(pos.x - randomX/2, pos.y - randomX/2, randomX, randomX)

      }
      var lineWidth = parseFloat($('#strokeWidth').val());
      
      if(isNaN(lineWidth)){
      	context.lineWidth = Math.floor(Math.random() * 5);
      }
      else{
      	context.lineWidth = lineWidth;
      }
      
      context.strokeStyle=color;
			context.stroke();
      var glowWidth = parseFloat($('#glowWidth').val());
      
      if(!isNaN(glowWidth)){
      	context.shadowBlur = glowWidth;
        context.shadowColor = color;
      }
      

      context.closePath();
      return {x:randomX, y:randomY};
  }
  
  function getMousePos(canvas, evt) {
  	var rect = canvas.getBoundingClientRect();
  	var x = evt.clientX;
  	var y = evt.clientY;
  	if(evt.touches){
  		x = evt.touches[0].clientX;
  		y = evt.touches[0].clientY; 
  	}
  	return {
			x: Math.floor((x-rect.left)/(rect.right-rect.left)*canvas.width),
			y: Math.floor((y-rect.top)/(rect.bottom-rect.top)*canvas.height)
    };
  }
  function toggleDrawOn(){
  	drawing = true;
  }
  function toggleDrawOff(){
  	drawing = false;
  }
  
  function toggleAutoDraw(){
  	shouldAutoDraw = !shouldAutoDraw;
  	if(shouldAutoDraw){
  		window.requestAnimationFrame(autodraw);
  	}
  }
  
  if(isMobile){
    document.getElementById("awesome").addEventListener('touchstart',toggleDrawOn, false);
  	document.getElementById("awesome").addEventListener('touchend',toggleDrawOff, false);	
	document.getElementById("awesome").addEventListener('touchmove', followMouse, false);

  }
  else{
  	document.getElementById("awesome").addEventListener('mousedown',toggleDrawOn, false);
  	document.getElementById("awesome").addEventListener('mouseup',toggleDrawOff, false);
  	document.getElementById("awesome").addEventListener('mousemove', followMouse, false);
  }
  	  clear();
  var drawing = false;
  var shouldAutoDraw = false;
  $("#clear").click(clear);
  $("#autoDraw").click(toggleAutoDraw);
});
