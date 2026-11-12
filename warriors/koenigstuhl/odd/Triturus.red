;redcode-tiny
;name Triturus
;author S.Fernandes
;strategy stone
;assert 1 || CORESIZE==800
 
step    equ    145
gate    equ    inc-2
 
inc     spl    #step ,  {-step
loop    mov    {step ,  hit-step
        add    inc   ,  loop
hit     djn.f  loop  ,  <350
clr     mov    wipe  ,  >gate
        djn.f  clr   ,  {gate
wipe    dat    2     ,  10
