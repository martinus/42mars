;redcode
;name easter replinator
;author Christian Schmidt
;strategy LP super paper
;assert 1

;----Replication----
l       equ     21;25
zofs    equ     6667;1971

;------Bombing------
bo1     equ     548;2638
bo2     equ     109;2649
color   equ     7293;4001

pGo
from    mov     #l,     #0
loop    mov     {bo1,   {bo2
         add     {0,     }0
         mov     <from,  {to
         jmn     loop,   from
         spl     >from,  }color
to      jmz     zofs,   *0

end pGo
