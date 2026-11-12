;redcode
;author Sascha Zapf
; ( Small help from Lukasz ;-) )
;name Pentagramm
;assert 1
;       (CORESIZE==2310)

; -- stone constants

sStp    equ    (107)              ;
sFst    equ    (-115-1)           ; first bomb is thrown here
sHop    equ    (6916+1)           ; offset between bombs thrown in one loop
sGat    equ    (sHop+sMov-1)      ; gate is formed here
sDjn    equ    (5500)             ; start of djn stream

sBo1    equ    (3467+orig)        ; stone offset
sOff    equ    (6)                ; offset between stone and bomb
sBo2    equ    (sBo1+sOff)        ;
sBmb    equ    (sRck+sOff)        ;

; -- imp constants

iStp    equ    (1223)             ; 3-point imps
iSDc    equ    (-iStp-1)          ;
iHp1    equ    (iImp-2*(iStp+1))  ;
iHp2    equ    (iImp+2*iStp-1)    ;
iBoo    equ    (3818+5+orig)      ; imp launcher offset

qStep   equ    7
qTime   equ    16
qOff    equ    87

qBmb    dat    <1777, <1459

; -- imp launcher

iPmp    spl    #iImp , #sSrc
        sub.f  #iSDc ,  iJmp
        mov     iImp , }iPmp
iJmp    jmp     iHp1 , >iHp2
iImp    mov.i  #   0 , iStp

for             10
                dat 0,0
rof

step    EQU     427
gate    EQU -1777
; Body

ptr             dat.f   #ptr,   #step
hop             mov.i   }ptr,   >ptr
                jmp             step-1, >-gate


for             10
                dat 0,0
rof


; -- stone

sSrc    spl    #sRck , <sGat      ; based on skew dwarf
sPtr    mov     sBmb , {sFst      ; but without hitting the
sMov    mov     sBmb , @sPtr      ; djn line.
                sub    #sStp ,  sPtr
                djn.f   sPtr , <sDjn
sRck    dat    <sHop , >   1

launch          spl             1
                mov.i -1,0


  spl           iPmp
        spl hop
                jmp             sSrc



        end launch
