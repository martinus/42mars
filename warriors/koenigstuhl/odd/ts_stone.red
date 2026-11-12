;redcode-odd
;author Lukasz Grabun
;name ts stone
;assert 1

step    equ     3510
hop     equ     46
gate    equ     (inc-6)

inc     spl     #step,<-step
        mov     {0+step,  <hit-step-hop
        mov     bomb,   @-1
        add.f   inc,    -2
hit     djn.f   -3,     <-step+inc
        mov     bomb,   >gate
        djn.f   -1,     >gate
bomb    dat     <2667 , hop+1
        end
