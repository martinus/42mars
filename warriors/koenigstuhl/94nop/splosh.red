;redcode-94nop
;name Splosh
;author Philip Thorne
;strategy John Metcalf's Core: Tournament Weekend 2025
;strategy
;strategy Quick Scan -> Clear
;kill Splosh
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)
;assert (MAXCYCLES==80000) && (MAXLENGTH==100)
;assert (MINDISTANCE==100)

;Basic clear is per Geist [nice S/D switch] with tweakings.

cptr:   dat     <2667,          800
     for 5
        dat     0,              0
     rof
bptr:   dat     1,              (eclr-cptr+3)   ;B incr for dec prot.
dptr:   spl     #cptr+70,       (eclr-cptr+3)   ;
        dat     0,              0   ;vbmb lands here
clr:
bBoot:  spl     #0,             >bptr-5
        mov     *bptr,          >cptr
        mov     *bptr,          >cptr
eclr:   djn.f   -2,             }dptr

        dat     1,              qA
qTab1:  dat     1,              qB
        dat     0,0
        dat     0,0

     for 34 + 20
        dat     0,              0
     rof

;Scan from Piltdown. Not optimised for this.
        qX      equ     6612
        qA      equ     3762
        qB      equ     2253
        qC      equ     1965
        qD      equ     456
        qE      equ     6947
        qF      equ     1199

        qStep   equ     7 
        qTime   equ     16
        qOff    equ     32

qBomb   dat     {qOff           , qF

qGo     sne     qPtr+qX*qE      , qPtr+qX*qE+qE
        seq     <qTab2+1        , qPtr+qX*(qE-1)+(qE-1)
        jmp     qDec            , }qDec+2
        sne     qPtr+qX*qF      , qPtr+qX*qF+qD
        seq     <qBomb          , qPtr+qX*(qF-1)+qD
        jmp     qDec            , }qDec
        sne     qPtr+qX*qA      , qPtr+qX*qA+qD
        seq     <qTab1-1        , qPtr+qX*(qA-1)+qD
        djn.a   qDec            , {qDec
        sne     qPtr+qX*qB      , qPtr+qX*qB+qD
        seq     <qTab1          , qPtr+qX*(qB-1)+qD
        djn.a   qDec            , *0
        sne     qPtr+qX*qC      , qPtr+qX*qC+qC
        seq     <qTab2-1        , qPtr+qX*(qC-1)+(qC-1)
        jmp     qDec            , {qDec+2
        sne     qPtr+qX*qD      , qPtr+qX*qD+qD
        jmz.f   bBoot           , <qTab2

qDec    mul.b   *2,             qPtr
qSkip   sne     <qTab1,         @qPtr
        add.b   qTab2,          qPtr
qLoop   mov     qBomb,          @qPtr
qPtr    mov     qBomb,          }qX
        sub     #qStep,         @qSkip
        djn     qLoop,          #qTime
        djn.f   bBoot,          #0

        spl     1,              qC
qTab2:  spl     1,              qD
        spl     1,              qE

;--
    end qGo

