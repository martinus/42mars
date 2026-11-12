;redcode-94odd
;name Switch'em
;author Roy van Rijn
;strategy Also my Frenzy Round 10 entry (no time to make something that quick!)+
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

w1      spl.x  $      1, #    275
        spl.i  }      1, *    274
        spl.f  *      0, @    263
        spl.i  @      0, }    338
        mov.i  }    799, >    799
        mov.i  {    401, {    200
        mov.i  {    797, {      1
        jmp.i  $     45, >    462

end think
