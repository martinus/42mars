;redcode-94b
;assert CORESIZE==8000
;name The Easter Feaster
;author /u/caw_wor
;strategy JMZ.F mod-1 vamp -> 4-pass wipe pit
;date 2016-Mar-04
;version 1

ORG main

marker EQU (pit - 400)
gate   EQU (fang - 27)
mod1   EQU 3359 
      
fang    JMP *marker-mod1, mod1+1

madd      ADD shifts,  fang
main      JMZ.F -1  , <fang  ;Shifts and start value are adjusted for this decrement.

refresh   MOV.A #pit-marker, marker
test      SLT fang, #progend-fang
bite      MOV fang, @fang
          JMP madd, <gate

pit
shifts  SPL #-mod1,mod1+1
pthrow  MOV *wipe, <wipe
        MOV *wipe, <wipe
        MOV *wipe, <wipe        
        JMP pthrow, <gate
pitend

  bomb4   DAT   #bomb4-wipe, #wipe-wipe
  bomb3   DAT   #bomb4-wipe, #fang-wipe
  bomb2   JMP   #bomb3-wipe, #fang-wipe
  bomb1   JMP   #bomb2-wipe, #fang-wipe

  wipe    NOP   #bomb1-wipe, #fang-wipe

progend END  
  



 








