;redcode-94nop
;name pst_v4
;author Stefan Kammann & Forge-AI
;strategy paper/stone: q^i -> self-metering parallel boot -> silk paper + stone
;strategy based on Azathoth by John Metcalf (launcher/stone/paper patterns)
;strategy and Eternal Exile by inversed (quickscanner); scan constants
;strategy re-derived from a data-driven coverage model, rest retuned
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

org     qscan

;---------------<< mini q^i quickscanner (aus clrsrc, hill-getuned) >>---------;

qbstep  equ     9
qbhop   equ    -67
qbcnt   equ     21

qxa     equ     3325
qxb     equ     7515
qa1     equ     3270
qa2     equ     5778
qb1     equ     3495
qb2     equ     4498
qstep   equ     3949

qa2qb2  equ     ((qa2*qb2)%CORESIZE)
qa2p1qb equ     (((qa2+1)*qb2)%CORESIZE)
qa2m1qb equ     (((qa2-1)*qb2)%CORESIZE)
nil     equ     (-CURLINE-1)
X       equ     found

        ;             --------~~~~~~~~([ instant ])~~~~~~~~--------            ;
qscan   sne     X + qxa                         , X + qxb
        seq     X + qxa + qstep                 , X + qxb + qstep
        jmp     decide                          , 0

        ;             --------~~~~~~~~([+0 cycles])~~~~~~~~--------            ;
        sne     X + qxa * qa2                   , X + qxb * qb2
        seq     X + qxa * qa2 + qstep           , X + qxb * qb2 + qstep
        jmp     dec0de                          , 0

        sne     X + qxa * qa1                   , X + qxb * qb1
        seq     X + qxa * qa1 + qstep           , X + qxb * qb1 + qstep
        jmp     dec0de                          , < dec1

        sne     X + qxa * (qa2 - 1)             , X + qxb * (qb2 - 1)
        seq     X + qxa * (qa2 - 1) + qstep     , X + qxb * (qb2 - 1) + qstep
        djn.f   dec0de                          , qtab

        sne     X + (qxa - 1) * qa2             , X + (qxb - 1) * qb2
        seq     X + (qxa - 1) * qa2 + qstep     , X + (qxb - 1) * qb2 + qstep
        djn.f   dec0de                          , found

        ;             --------~~~~~~~~([+1 cycle ])~~~~~~~~--------            ;
        sne     X + qxa * qa2qb2                , X + qxb * qa2qb2
        seq     X + qxa * qa2qb2 + qstep        , X + qxb * qa2qb2 + qstep
        jmp     dec1                            , 0

        jmp     warr                            , 0

dec1    mul.x     qtab      ,   qtab
dec0de  mul     @ dec1      ,   found
decide  sne     * found     , @ found
        add       qinc      ,   found
        seq       nil       , * found
        mov.x     found     ,   found

qbloop  mov       qbomb     , @ found
found   mov       qxa       , } qxb
        add     # qbstep    ,   found
        djn       qbloop    , # qbcnt
        jmp       warr      ,   0
qbomb   dat     > qbhop     , > 1

        dat       qa1       ,   qb1
qtab    dat       qa2       ,   qb2
qinc    dat       qstep     ,   qstep

        for       27
        dat       0         ,   0
        rof

;---------------<< Launcher: selbst-messender 6-Prozess-Parallel-Boot >>-------;
; Prinzip (aus Trace nachvollzogen): Fan erzeugt 6 Prozesse in FIFO-Wellen.
; Jeder kopiert 1 Paper- und 1 Stone-Zelle; die Kopierzeiger sind die A-Felder
; von s/p selbst -> nach 6 Kopien zeigen spl/djn exakt auf die Kopien.
; Jeder Prozess spawnt 3 Stone-Prozesse und betritt dann selbst das Paper.

pbo2    equ     843
sbo     equ     3200
pboot   equ     warr + pbo2
sboot   equ     warr + sbo
d1      equ     3828
d2      equ     2602
d3      equ     1351
d4      equ     3493
d5      equ     1406
d6      equ     3947

warr    spl     2           , < -d1
        spl     1           , { -d2
        spl     1           , } -d3
        mov     < p         , { p
        mov     < sgo       , { s
s       spl     sboot       , < d4
        spl     * s         , { d5
        spl     * s         , { d6
p       djn.f   pboot       , } silk1 + 6

;---------------<< Stone: bidirektional (laeuft bei sboot-6..sboot-1) >>-------;

sstep   equ     2431
stime   equ     1470
sback   equ    -2122
sfirst  equ     (shit + sptr + sstep * stime)

sgo     spl     # 0         ,   6
sloop   mov       sbomb     , @ sptr
shit    sub.x   # sstep*2   , @ sloop
sptr    mov     { sback     , } sfirst
sdjn    djn.f   @ shit      , } sptr
sbomb   dat     } sstep     , > 1

;---------------<< Paper: 3 Silk-Streams (laeuft bei pboot-6..pboot-1) >>------;

pstep   equ     1365

silk1   spl     pstep       , { px
        mov     } px        , } silk1
        mov     } px + 3    , } silk1
px      mov     { px + 3    , } silk1
        jmz.f   @ px - 1    , * px

;------------------------------------------------------------------------------;

        end

