;redcode-DN
;name LPower
;author Christian Schmidt
;strategy anti-imp LP paper, scanner, dwarf
;assert 1

;------------LP paper AI-------------------

;----Replication----
l       equ     26
zofs    equ     2309

;------Bombing------
bo1     equ     6327
bo2     equ     2285
color   equ     686
a       equ     4029
b       equ     5354
c       equ     4846

from    mov     #l,      #0
loop    mov     d1 ,     >a
       mov     d1 ,     >b
       mov     d1 ,     >c
       mov     <from,   {to
       jmn     loop,    from
       spl     >from,   }color
to      jmz     zofs,    *0
d1      dat     <5334 ,  <2667



for     34
        dat     0,              0 
rof 

;------------Scanner-------------------

STEP    equ     5379
SDIST   equ     from+5085       ;6421;1703
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
w2      equ     from

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

