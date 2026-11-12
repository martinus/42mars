;redcode-94nop
;name Switch'em
;strategy Switch!
;author Roy van Rijn
;assert 1

pspace  dat   0,        0
        dat   0,        0
sStep   equ     6

off     mov   >sStep,   {-sStep
sto     mov   >sStep*2, 1-sStep*2
        add   off,      sto
        jmp   sto,      off

state   equ     (pspace)

think   ldp     }state,       state
        ldp.ab  state,        @state
        stp.a   @state,       <state+1
        jmz.b   off,          @state+1


pap     mov   #8,       #8
        add.a #2343,    to
loop    mov   <pap,     {to
        mov   4,        {4412
        jmn   loop,     pap
        spl   pap,      {4212
to      jmz   5223,     *0
        dat   }1,       >1

end think
