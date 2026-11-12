;redcode-94
;name D: Son of Clis
;assert 1
;strategy Basicly Clisson...
;author Roy van Rijn

cStart    mov.ab #86,66
cClisson  sne    {cWatch1,{cWatch1
   jmz.f  -1,@64
   add.a  #3,cWatch1
   mov    <cWatch1,{cWatch1
   djn    -1,#5
   add.a  #1,cWatch1
cWatch1   jmp    -200,cQb+5

cQb       dat    #1 ,-3
          mov    cQb ,<cQ4            ; Very tiny clear
cQ4       djn    -1 ,#cQb

