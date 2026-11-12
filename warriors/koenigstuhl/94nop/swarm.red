;redcode-94nop
;name Swarm
;author Roy van Rijn
;strategy 8 process cc paper and 4 process imp paper
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

iStep       equ     2667

;optimizer:
;78.14978260869565
;14530.281690140846

pOff1       equ     6788
pOff2       equ     3144

pStep1      equ     7516
pStep2      equ     2839
pStep3      equ     544
bStep1      equ     1194
bStep2      equ     714

pStep4      equ     7827
bStep3      equ     270
djnHop      equ     2195
djnOff      equ     5705

wGo         spl     1                   , < 5221
            spl     1               	, {qb1
qbomb       spl     iBoot             	, {qb2
            spl	    1 	                , {qb3

sBoot       mov.i   <1                  , {1
            jmp     pOff1               , sGo+8

iBoot       mov.i   <2                  , {2
            mov.i   <1                  , {1
            jmp     pOff2               , iGo+8

for 4
            dat     0                   , 0
rof

            dat     }qoff               , qa1
tab2        dat     }qoff               , qa2

for 8
            dat     0                   , 0
rof

sGo         spl     @0                  , }pStep1
            mov.i   }-1                 , >-1
            spl     @0                  , }pStep2
            mov.i   }-1                 , >-1
            spl     @0                  , }pStep3
            mov.i   }-1                 , >-1
            mov.i   #bStep1             , <1
            djn.b	-2	                , #bStep2

for 12
            dat     0                   , 0
rof

iGo         spl     @0                  , < pStep4
            mov.i   }-1                 , >-1
            mov.i   }-2                 , >-2
pStone      spl     #0
            mov.i   }bStep3             , <ptr
            add.x   imp                 , ptr
ptr         djn.f   imp-iStep*4         , {djnOff
imp         mov.i   #djnHop             , iStep

for 14
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
        jmp    wGo

end qgo

