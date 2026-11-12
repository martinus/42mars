;redcode-94nop
;name The Collective
;author Roy van Rijn
;strategy qscan > boot > LP paper
;strategy Based on Borg, with extra indirect bombing
;assert 1

base  z for 0
        rof

qb1    equ   7165
qb2    equ   1749
qb3    equ   2719
qa1    equ   4489
qa2    equ   5294
qc1    equ   3618
qgap   equ   5609
qz     equ   5714

qgo
       sne.i qptr + 1252	, qptr+6861
       seq.i <tab	, qptr+1147
       jmp   dec	, }dec ;tab*qz
       sne.i qptr+2146	, qptr+7755
       seq.i <(tab2-1)	, qptr+2041
       djn.a dec	, {dec ;(tab2-1)*qz
       sne.i qptr+1916	, qptr+7525
       seq.i >(tab2)	, qptr+7630
       jmp   dec	, {dec   ;tab2*qz
       sne.i qptr+4810	, qptr+2419
       seq.i <(qbomb-1)	, qptr+4705
       jmp   dec	, {qptr ; (qbomb-1)*qz
       sne.i qptr+366	, qptr+5975
       seq.i <(qbomb+1)	, qptr+261
       jmp   dec	, }qptr ; (qbomb+1)*qz
       sne.i qptr+1786	, qptr+7395
       seq.i <(qbomb)	, qptr+4072
tab    jmp   *-6  	, qc1 ; also used as qstep
       sne.i qptr+6358	, qptr+3967
       seq.i >qptr	, qptr+105
       jmp   dec,<qbomb
       seq.i qptr+5370	, qptr+2979
       jmp dec , }qptr
       seq.i qptr+545	, qptr+6154
       djn.b dec,{qptr
       seq.i qptr+4925	, qptr+2534
       jmp dec ,{dec
       jmp pBoot

            dat     0               	, {qb1
qbomb       dat     0                	, {qb2
            dat     0                   , {qb3

for 9
            dat     0                   , 0
rof

            dat     }qoff               , qa1
tab2        dat     }qoff               , qa2

for 10
            dat     0                   , 0
rof

; Benchmark properties:
; 16814.740988302696
; 90.35354838709678

pStep       equ     7730
bStep1      equ     3358;816
bStep2      equ     4923;2827
bHop        equ     6
bDist       equ     7661;6531

cLen        equ     23


pGo         mov     #cLen               , #10
pLoop       mov     <pGo                , <pDest
            mov     pBmb                , @bPtr
bPtr        mov     <bStep1             , }bStep2
            add     <0                  , >0
            mov     pBmb                , }bPtr
            jmn     pLoop               , pGo
            spl     >pGo                , <4000
pDest       jmz     @0                  , pStep
pBmb        dat     <bHop               , <1

for 10
            dat     0                   , 0
rof

pBoot       mov.i   pGo                 , pGo+bDist
n for 9
            mov.i   pGo+n               , pGo+n+bDist
rof
            jmp     pGo+1+bDist

for 9
            dat     0                   , 0
rof

qoff    equ     -87
qstep   equ     -7
qtime   equ     19
zero    equ     qgo-1

dec     mul.b   *qptr    , qptr
        sne.i   zero     , @qptr
        add.ab  #qgap    , qptr
        mov.i   tab2     , @1
qptr    mov.i   >qbomb   , }qz
        sub.ab  tab      , qptr
        djn     -3       , #qtime
        jmp    pBoot

end qgo

