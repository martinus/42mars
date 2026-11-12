;redcode
;name The Utterer TNX
;author Christian Schmidt
;strategy spreader
;assert 1

;-------Constants for Tiny-----------
for CORESIZE==800
sBoo    equ     197
iBoo    equ     618
sDst    equ     370
iDst    equ     530
iBmb    equ     416
iBmb2   equ     216
sStep1  equ     361
sStep2  equ     722
sStep3  equ     161
sStep4  equ     753
tRail1  equ     249
tRail2  equ     272
tRail3  equ     442
iStep   equ     (CORESIZE/3)+1
rof
;-------Constants for Tiny-----------

;-------Constants for 94nop----------
for CORESIZE==8000
sBoo    equ     851
iBoo    equ     7152
sDst    equ     1518
iDst    equ     5206
iBmb    equ     4697
iBmb2   equ     3318
sStep1  equ     3997
sStep2  equ     5962
sStep3  equ     3274
sStep4  equ     6777
tRail1  equ     6196
tRail2  equ     7391
tRail3  equ     1591
iStep   equ     (CORESIZE/3)+1
rof
;-------Constants for 94nop----------

;-------Constants for 94x------------
for CORESIZE==55440
sBoo    equ     17186
iBoo    equ     1131
sDst    equ     52932
iDst    equ     42845
iBmb    equ     27200
iBmb2   equ     11213
sStep1  equ     46559
sStep2  equ     832
sStep3  equ     28135
sStep4  equ     34988
tRail1  equ     55297
tRail2  equ     30572
tRail3  equ     46002
iStep   equ     34117
rof
;-------Constants for 94x------------



dDst    dat     #sBoo,          #iBoo

pGo     spl     1,              <tRail1
        spl     1,              <tRail2

sCpy    mov.i   <sSrc,          {dAwa
sAwa    spl     *dAwa,          >sSrc
iCpy    mov.i   <iSrc,          <dAwa
iAwa    spl     @dAwa,          >iSrc
        add.f   dDst,           dAwa
        djn.f   sCpy,           {tRail3

dAwa    dat     #sDst,          #iDst

        spl     #sStep1,         >sStep2
        mov     {sStep3,         {sStep4
        add     -2,             -1
pEnd    djn.f   @0,             {-2
sSrc    dat     0,              0

iStart  spl     #iStep,         <iBmb
        add.f   iStart,         launch
launch  djn.f   imp-iStep-1,    <iBmb2
imp     mov.i   #iStep,         *0
iSrc    dat     0,              0


end    pGo
