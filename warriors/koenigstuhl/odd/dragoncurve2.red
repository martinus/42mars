;redcode-fractal
;name Dragon Curve 2
;author John Metcalf
;assert 1

       width  equ 512
       stack  equ dragon+100
       plot   equ direct+width+1
       first  equ 80*width+50

       mov    #first,   plot
dragon  mov.ab count,    <plot
test    mov.b  @plot,    #0
       add.ba @plot,    direct
       div    #2,       @plot
       mod    #2,       test
       jmz    test,     test
       mod.a  #4,       direct
direct  add.b  3,        width+1
count   sub.ba #65536,   #1+1
       jmp    dragon,   -width+1

