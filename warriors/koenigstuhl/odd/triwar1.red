;redcode-94x verbose
;name Tri Warrior 1 (20 lines)
;author Simon Duff
;assert 1

step  equ   13

trap:    spl   #0,   #0
         spl   1,    1
         mov   -1,   >ptr
ptr:     jmp   -3,   #(incr+2)

start:   spl   #0,   #0
         add.f incr, bmba
         mov   bmba, @bmba
         jmz.f -2,   trap   

clear:   spl   #0,   #0
         mov   incr, >ptr
         djn.f -1,   >ptr

incr:    dat   #-step,#step
bmba:    jmp   trap-11, 11

         end start

