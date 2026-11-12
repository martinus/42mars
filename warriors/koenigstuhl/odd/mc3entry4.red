;redcode
;name Perfect Solution
;author John Metcalf
;strategy Neogryzor's Mini Challenge #3
;strategy bombs with either DAT or MOV
;assert 1

     pos   equ (less-istep*7)
     istep equ (2667)

less:jmz   less,   pos
     nop   0,      0
     mov.i #1,     <1
     jmp   #0,     pos

     phi   equ (less+10-2667)

pre: seq   @ptr,   *ptr
     jmp   less
loop:sne   <ptr,   {ptr
     seq   <ptr,   {ptr
     jmp   atk
     djn   loop,   #5
     jmp   less

atk: sne   db,     @ptr
ptr: mov.x #phi,   #phi-2667
     mov   db,     <ptr
     jmp   #0

db:  end   pre

;	***** SCORE: 100% WINS *****
