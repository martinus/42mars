;redcode-94
;name DoubleTrouble
;author Roy van Rijn
;strategy Big switcher between two strategies
;assert 1

        RESULT  equ 0
        STATE   equ #125

_RES EQU #0
_STRAT EQU #1

result  ldp.ab _RES, wlt
strat   ldp.a _STRAT, choice

wlt     sne.ab #1, #0
        jmp win                 ; win has occured
        add.a #1, choice        ; loss or tie has occured
        mod.a #4, choice
        stp.a choice, _STRAT
choice  jmp @0, strat1          ; _STRAT = 0, choose strat1
        nop 0, strat1           ; _STRAT = 1, choose strat1
        nop 0, strat2           ; _STRAT = 2, choose strat2
        nop 0, strat2           ; _STRAT = 3, choose strat2
win     mov.ab choice, #0       ; reset index becuase of win
        mod.ab #2, win
        sub.ba win, choice
        jmp choice-1

strat1
        ldp.ab  STATE,  calc2
        ldp.a   RESULT, calc2

calc2   add.ab  #1,     #1
        djn     1,      calc2
        slt     calc2,  #5
        add     #3,     calc2
        add.ba  calc2,  jump2
jump2   jmp     @0,     preboot
        dat     0,      slDodger-1      ;slDodger
        dat     0,      SRC-1           ;Paper

strat2
        ldp.a   STATE,  jump
        ldp.a   RESULT, calc

calc    sne     #0,     #1
        jmp     jump
j_mp    add.a   #1,     jump
        mod.a   #3,     jump
        stp.ab  jump,   STATE
jump    jmp     @0,     slDodger-1
        dat     0,      SRC-1
        dat     0,      preboot

        stp     #2,STATE ;save state and start Cloner II
;********************Cloner II********************

SRC	  mov	 FIX,	   -1
CPY	  mov	@SRC-1,	   <DST
	  mov	<SRC-1,	   <DST
	  mov	<SRC-1,	   <DST
	  mov	<SRC-1,	   <DST
	  djn	 CPY,	   SRC-1
DST	  spl	 @DST,	   5000
HNT	  jmz	 HNT,	   <DST
	  jmp	 SRC
FIX	  dat	 0,	   12
	  dat	 0,	   0
	  dat	 0,	   1
;*****************************************************


        stp      #1,STATE ;save state and start CLP
;*************************CLP********************
slDodger  mov    <btDodger,{btDodger
          mov    <btDodger,{btDodger
          mov    <btDodger,{btDodger
          mov    <btDodger,{btDodger
          mov    <btDodger,{btDodger
          djn    -4       ,#4
btDodger  jmp    pescape+300,pescape

plen      equ    (pescape-p1)

p1        mov    pb       ,@pfence
          mov    pb       ,*pfence
ploop     add    pincr    ,psnare
          mov    psnare   ,@psnare
pfence    sne    pb-46    ,pb+26
          jmp    ploop
          add    preset   ,psnare
          mov    pb       ,pescape
pcopy     mov    >pescape ,}pescape
          jmn.b  -1       ,pescape
preset    jmp    p1+5093  ,-p1-5093
psnare    jmp    ptrap-200,+200
ptrap     mod.x  #10      ,#1
          stp.ab #0       ,#0    ;<-- values of the a- and b-fields can 
be 
modified during the battle
          djn.b  -1       ,-1
pincr     mov    1        ,-1
pb        dat    5093+p1-pescape,-plen
pescape   dat    0,0
;*****************************************************

preboot stp     #0,STATE ;save state and jmp to Oneshot
        jmp     boot,   0
;********************Frontwards************************
offset    equ    608
step      equ    12
stream    equ    cc-806
first     equ    (cc-offset+203)
gate      equ    -50

p         dat    #first,   {first+step
          dat    #30,      {-1
          dat    #30,      {-1
cc        spl    #30,      stream-660
          dat    0,        0
          dat    0,        0
          dat    0,        0
boot      mov    top+5,    top+offset+5
    for 5
          mov    {boot,    <boot
    rof
boot2     mov    cc,       cc+offset
    for 3
          mov    {boot2,   <boot2
    rof
          jmp    x+offset
top       sub    x,        @x
x         sne    *p,       @p
          djn.f  -2,       <stream
          spl    #0,       <p
          mov    @1,       }p
          djn    -1,       <cc
;*****************************************************
end result
