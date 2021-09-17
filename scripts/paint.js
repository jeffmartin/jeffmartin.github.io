$(document).ready(function(){
	function getRandomColor() {
  	var toggle = {
    	r: $('#toggleRed')[0].checked,
    	g: $('#toggleGreen')[0].checked,
    	b: $('#toggleBlue')[0].checked
    };
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
  	if (!pendown) return;
  	var canvas = document.getElementById("awesome");
  	var pos = getMousePos(canvas, evt);
    var context = canvas.getContext("2d");
      var randomX = Math.floor(Math.random() * canvas.width)
      var randomY = Math.floor(Math.random() * canvas.height)
      var color = getRandomColor();
context.beginPath();
			var brush = $('#brush').val()
      
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
  }
  
  function getMousePos(canvas, evt) {
  	var rect = canvas.getBoundingClientRect();
  	return {
			x: Math.floor((evt.clientX-rect.left)/(rect.right-rect.left)*canvas.width),
			y: Math.floor((evt.clientY-rect.top)/(rect.bottom-rect.top)*canvas.height)
    };
  }
	document.getElementById("awesome").addEventListener('mousemove', followMouse, false);
  clear();
  var pendown = true;
  $("#clear").click(clear);
  $('#awesome').click(function(){
  	pendown = !pendown;
    $('#penNotice').toggle(!pendown);
  });
});
