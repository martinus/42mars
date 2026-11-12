;redcode-fractal
;name Dragon Curve
;author John Metcalf
;assert 1

       width  equ 315
       stack  equ dragon+100

dragon  mov.x  paira,    <stack
recur   djn    dragon,   #15
       mod.a  #4,       direct
       add.b  *direct,  plot
plot    mov    >recur,   80*width+110
       mov.ba >stack,   ret
ret     jmp    0,        }stack
turn    add.a  @stack,   direct
       mov.x  pairb,    <stack
       jmp    recur

direct  dat    3,        width
paira   dat    turn-ret, -1
       dat    0,        -width
pairb   dat    plot-ret, 1

