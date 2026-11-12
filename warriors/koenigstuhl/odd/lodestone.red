;redcode-odd
;name Lodestone
;author John Metcalf
;strategy stone -> continuous anti-imp clear
;strategy IRCT 12 probe warrior
;assert CORESIZE==8000

        hop     equ             13
        step    equ             119
        time    equ             1478

sb      spl     #1,             hop
loop    mov     db,             >hit-(hop+time*step)
hit     mov     sb,             @loop
        add     #step,          @hit
        djn.f   loop,           <-1001

        dat     0,              0
        dat     0,              0

db      dat     <5334,          <2667

        end
