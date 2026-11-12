;redcode-94
;name Yggdrasil
;author Christian Schmidt
;strategy - Giant ash tree that links and shelters all of the worlds
;assert 1

;------------clear/imp-------------------

cAwa    equ     5691
iAwa    equ     5364
jAwa    equ     5539
cSwch   equ     5585

ptr     equ     (wipe-5)

iStep   equ     2667

zero    equ     pGo-1

pGo     mov     imp,            zero+jAwa
        mov     <wipe+5,        <bPtr1
bPtr1a  spl     1,              <7277
        spl     1,              <6323
        mov     <wipe+5,        <bPtr1
        mov     <iGo+4,         {bPtr2
bPtr1   spl     zero+cAwa-4,    zero+cAwa
bPtr2   djn.f   zero+iAwa,      <400

imp     mov.i   #iStep,         *0

for     10
        dat     0,              0 
rof 

iGo     spl     #iStep,         <6774
        add.f   iGo,            iPtr
iPtr    spl     jAwa-iAwa-iStep+1,  <1921
        djn.f   cAwa-iAwa-3,    <6831

for     1+2
        dat     0,              0 
rof 

wipe    dat     1,              14
clear   spl     #cSwch,         14
        mov     *wipe,          >ptr
        mov     *wipe,          >ptr
        djn.f   -2,             }clear

for     10
        dat     0,              0 
rof 

;------------Scanner-------------------

STEP    equ     5379
SDIST   equ     zero+5085       ;6421;1703
sgate   equ     (scan-2)

scissor mov     *sclr,          @sptr
for     8
        mov     {sclr,          <sptr
rof
sptr    mov.ab  #5000,          @SDIST
        mov     {sclr,          <sptr
sjmp    djn.f   @sptr,          sptr

        dat     0,              0 
        dat     0,              0 

scan    add     #STEP,          #STEP
mv      mov     sclr,           >scan-1
pscan   jmz.f   scan,           @scan
        slt     scan,           #sclr+1-scan
chg     mov.i   @pscan,         @mv
chk     jmn     scan,           scan
        mov.f   dclr,           >chk
        djn.f   <chg,           {chg
dclr    dat     381,            sclr+1-sgate
sclr    spl     #0,             {0


;------------p-brain------------------

pLoc    equ     5

w0      equ     dwarf
w1      equ     scissor
w2      equ     pGo

pThink  ldp.a   #0,             in
        ldp.a   #pLoc,          pTab
        mod.ba  *in,            pTab
        stp.b   *pTab,          #pLoc

pTab    jmp     }0,             4180
        spl     #w0,            4580
        spl     #w0,            4980
        spl     #w0,            5380
        spl     #w1,            4184
        spl     #w1,            4584
        spl     #w1,            4585
        spl     #w2,            4187
        spl     #w1,            5784
        spl     #w1,            6184
        spl     #w1,            6185
        spl     #w2,            11
in      dat     0,              21 
        spl     1,              20
        spl     1,              19


;------------dwarf------------------

dstep   equ     81
dhop    equ     5277
dtime   equ     1677
dbmb    equ     (dend+4)

dwarf   mov     dend,           @dptr
        mov     {dwarf,         <dptr
        mov     {dwarf,         <dptr
dptr    mov     datb,           *5421
        mov     {dwarf,         <dptr
        mov     {dwarf,         <dptr
djmp    djn.f   @ dptr,         dptr

        dat     0,              0 

        spl     #0,             <dhop+2
dloop   mov     dbmb,           {(dstep*dtime)+1
        mov     dbmb,           @dloop
        sub     #dstep,         dloop
dend    djn.f   dloop,          <dhop-2
datb    dat     <dhop+1,        >1

end     pThink

