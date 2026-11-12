;redcode
;name Bluff
;author anonymous
;strategy example from MCmicrocomputer issue 68
;assert CORESIZE==8000

; - 8< ------------------------------------------

; BLUFF
;
step       EQU   17
pointer    DAT   #(bomb+1)
start      MOV   bomb,@pointer
           ADD   #step,pointer
           JMP   start
bomb       DAT   #0

; - 8< ------------------------------------------
           end   start

