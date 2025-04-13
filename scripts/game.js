var game = function(){
	
	function gameLoop() {
        ctx.clearRect(0,0, W, H);
        
        var nextLoopObjects = [];
        
        for (var i in objects) {
            objects[i].step();
        }
        
        for (var i in objects) {
            objects[i].draw();
        }
        
        objects = objects.filter(function(sprite){return !sprite.dead;});
    }
    
    function startGame() {
        window.gameLoopTimer = setInterval(gameLoop, Math.floor(1000/FPS) );
    }
    
    function stopGame() {
        gameLoopTimer = clearInterval(gameLoopTimer);
    }
    
    function initPage() {
        window.W = window.innerWidth - 100;
        window.H = window.innerHeight - 100;
        window.canvas = document.getElementById('game-canvas')
        canvas.width = W;
        canvas.height = H;
        window.ctx = canvas.getContext('2d');
        initGame();
    }

}