;redcode-94x
;name unnoticed
;author John Metcalf
;strategy IRCT10 one-shot
;       CORESIZE==800
;assert 1

      step  equ 12

loop: add.b inc,   ptr
ptr:  jmz.f loop,  step*2
inc:  spl   0,     step
clr:  mov.f bomb,  >ptr
      djn.f clr,   >ptr
bomb: dat   40,    8

      end   ptr
