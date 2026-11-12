;redcode-94nop
;name 3 Line 0.4c Stone
;strategy 3 Line 0.4c Stone
;strategy This is a proof of concept warrior :-)
;author Anton Marsden
;assert CORESIZE==8000

step EQU 2365

sbomb spl #1,1
dat 0,0
a   add.x  #step+1, 2
   mov.i  sbomb, @1
   djn.f  -2, #step-2
   mov.i 1, <a

END a

