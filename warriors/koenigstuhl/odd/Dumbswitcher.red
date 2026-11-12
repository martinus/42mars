;redcode-94
;name D:umb switcher
;author David Houston
;assert 1


org     brain

state   equ     off-100

wptr:   dat     1, 40
        jmp     #2, 40
        dat     2, 40

off:    mov     *wptr, >wptr
        jmp     -1, <1000

brain:
        ldp     }state, state
        ldp.ab  state, @state
        stp.a   @state, <state + 1
        jmz.b   off, @state + 1


sStep     equ   1954
bdist   equ     1154

        mov     <bptr, {bptr
        mov     <bptr, {bptr
        mov     <bptr, {bptr
bptr:   jmp     bdist + 3, Stone + 3

Stone   mov    {1601, 1-sStep
        sub.x  #sStep, -1
        jmp    -2, }-2
