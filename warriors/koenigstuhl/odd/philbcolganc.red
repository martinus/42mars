;redcode-94
;name Philb/Colganc
;author Philb/Colganc
;strategy p-warrior teamplay
;strategy for IRC21
;assert 1

org     think

;---------------Philb--------------------------
; -- stone constants

step    equ     (3510)
hop     equ     (46)

gate    equ     (inc-6)

from    equ     (0+step)
hit     equ     (loop-step-hop)

soff    equ     (2498+ioff)     ; stone offset


; -- stone

inc     SPL.B   #step   , <-step
        MOV.I   {from   , <hit
        MOV.I   bomb    , @-1
        ADD.F   inc     , -2
loop    DJN.F   -3      , <-step+inc
        MOV.I   bomb    , >gate
        DJN.F   -1      , >gate
bomb    DAT.F   >5335   , hop+1

    for 3
        dat     0,      0
    rof

TBOOT   EQU     inc+3036
boot:   spl     1,              carpet+CBOOT
        mov.i   <leap,          {leap
        mov.i   <leap,          {leap
        mov.i   <leap,          {leap
        mov.i   <leap,          {leap
leap:   spl     inc+TBOOT+8,    inc+8

        mov.i   <carpet+4,      <boot
        mov.i   <carpet+4,      <boot
        jmp     @boot

    for 2
        dat     0,              0
    rof

CBOOT   EQU     TBOOT+2000
carpet: spl     #2,             1
        mov.i   -1,             >4000
        mov.i   -2,             >3999
        jmp     -1

;---------------Colganc--------------------------

Colganc	SPL 5, 0
	ADD #32, 3
	MOV 2, @2	
	JMP -2, 0
	DAT #0, #100	;5

	SPL 5, 0
	ADD #8, 3
        MOV 2, @2
        JMP -2, 0
        DAT #0, #200	;10

	MOV 2, 4001
	SPL 4000, 0
	MOV 0,1

;----------------p-Switcher--------------------------

STORE   equ     250
w0      equ     boot
w1      equ     Colganc


        dat     0,           0
in      dat     0,           10
        dat     0,           9
        dat     0,           11

think   ldp.a   #0,          in
        ldp.a   #STORE,      table
        mod.ba  *in,         table
        stp.b   *table,      #STORE
table   jmp     }0,          226
        dat     w0,          650
        dat     w0,          101
        dat     w0,          886
        dat     w0,          653
        dat     w0,          104
        dat     w1,          889
        dat     w1,          656
        dat     w1,          107
        dat     w1,          630
        dat     w1,          226

        end