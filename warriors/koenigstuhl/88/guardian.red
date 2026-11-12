;redcode
;name Guardian
;author Ian Oversby
;strategy QScan -> Imp/Stone
;assert 1

;----------------------------------------------------------------

; qscan constants

QB equ -1200
QS equ  (2*QI)
QI equ  -100

;----------------------------------------------------------------

; q^2 fast scan/bomb

       jmp  44,  91
       jmp  33,  69
       jmp  22,  47
qjb    jmp  11,  25

qa3    add  @qs3,  qp
qa2    add  @qs2, @-1
qa1    add  @qs1, @-2
qa0    cmp   @qp, last+1
qjbp   jmp     2, qjb+1
       add #QI+1, qp

       mov     qt2, @qp
       mov    stun, <qp
       mov    spin, <qp

       sub   #10,  qp
       mov <qjbp, <qp
qp     mov 2+last+launch-cboot, <main+QB
       djn    -3,  #4

       jmp  main, QS*2
qt2    jmp    -2, QS*7

qscan  cmp main+QB+(QS* 0), main+QB+(QS* 0)+QI
qs1    jmp qa0, qt1

       cmp main+QB+(QS* 1), main+QB+(QS* 1)+QI
qs2    jmp qa1, qt2
       cmp main+QB+(QS* 5), main+QB+(QS* 5)+QI
       jmp qa1, <qs1

       cmp main+QB+(QS* 8), main+QB+(QS* 8)+QI
qs3    jmp qa2, qt3
       cmp main+QB+(QS* 3), main+QB+(QS* 3)+QI
       jmp qa2, <qs2
       cmp main+QB+(QS* 7), main+QB+(QS* 7)+QI
       jmp qa2, <qa1
       cmp main+QB+(QS*12), main+QB+(QS*12)+QI
       jmp qa2, <qs1

       cmp main+QB+(QS*11), main+QB+(QS*11)+QI
       jmp qa3, 0
       cmp main+QB+(QS* 4), main+QB+(QS* 4)+QI
       jmp qa3, <qa2
       cmp main+QB+(QS* 6), main+QB+(QS* 6)+QI
       jmp qa3, <qs2
       cmp main+QB+(QS* 9), main+QB+(QS* 9)+QI
       jmp qa3, <qs3
       cmp main+QB+(QS*10), main+QB+(QS*10)+QI
       jmp qa3, <qa1
       cmp main+QB+(QS*15), main+QB+(QS*15)+QI
       jmp qa3, <qs1

;;----------------------- Boot the stone ----------------------------

pat     equ     95
sval    equ     5300    ; More or less
ival    equ     3300    ; More or less
st      equ     2667
last equ (qt3+1)

;;-------------------------------------------------------------------

main    MOV     gate,   @sptr
        SUB     #pat,   sptr
        MOV     <spos,  @sptr
        SPL     cboot,  <-300
for 5
        MOV     <spos,  <sptr
rof

        SPL     @sptr,  <-200
        MOV     last, sptr

sptr    DAT     #0,     #sval+pat

init    SPL     0,      <-95
stone SPL     0,      #0
loop    MOV     <pat-1, hit-pat
        ADD     clear,  loop
hit     DJN     loop,   <-2570
clear   MOV     pat,    <-pat

spos    DAT     #0,     #0

gate    DAT     <-96,   <-96

;;--------------------- Boot the imp/launch -------------------------

cboot   MOV     <ipos,  <iptr
for 5
        MOV     <ipos,  <iptr
rof
        SPL     @iptr,  <-300
        MOV     last, iptr

iptr    DAT     #ival,  #ival

spin    SPL     0
        ADD     #st+1,  jump
jump    JMP     @0,     impy-st-1
impy    MOV     0,      st
        MOV     0,      st
        MOV     0,      st

ipos    DAT     #0,     #0

stun spl  -1, <2-82

launch spl cboot,QS*5
qt1    spl 1,QS*1
qt3    spl 1,QS*3

;----------------------------------------------------------------

end qscan

