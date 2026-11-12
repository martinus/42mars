;redcode-94
;name Randomized Rage 2
;author Christian Schmidt
;strategy Entry #1 for the Random Rage Round 
;assert 1

;The first step is to calculate the coresize
;If it is smaller than 2000 then adjust and run
;BiShot like for the tiny hill. It should beat
;most opponents. I think I don't have to fear
;CLP's, because they seems to be not so effective
;on small coresizes.
 
;If it is larger than 2000 go to the
;p-switcher and choose between the following stategies
;d-clear:   against HSA-stylish scanner and imps
;CLP:       against oneshots and core-clears,
;BiShot:    against papers,
;Paperazor: against everything else 
;
;I hope for many HSA-style scanner, oneshots,
;coreclear, stone/imps and papers ;-)

;**************BiShot***************

sOff    equ     (sOne+2+100)

sOne    add.f   #sPtr,       sPtr
        sne.i   *sPtr,       @sPtr
        djn.f   sOne,        @sPtr
        djn.f   sBomb,       sPtr

    for 4
        dat     0,           0
    rof

sPtr    dat     sOff,        4+sOff
        dat     10,          10
sBomb   spl     #20,         -200
sLoop   mov     sBomb,       }sPtr
        mov     sBomb,       >sPtr
sBack   djn.a   sLoop,       <sBomb

    for 19
        dat     0,           0
    rof

;********CORESIZE Calculator********

gDiv    equ     10
gSval   equ     2000

gCount  div     #gDiv,       #-1
        slt.ab  #(gSval/gDiv),gCount
        jmp     gSmall,      >gCount

;***p-switcher for large CORESIZE***

STORE   equ     256 
w1      equ     clp
w0      equ     aHSA
w2      equ     gSmall
w3      equ     sStart

gLarge  ldp.a   #0,          in
        ldp.a   #STORE,      table
        mod.ba  *in,         table
        stp.b   *table,      #STORE
table   jmp     }0,          226
        dat     w0,          650 
        dat     w0,          101 
        dat     w1,          886 
        dat     w1,          653 
        dat     w1,          104 
        dat     w2,          889 
        dat     w2,          656
        dat     w2,          107 
        dat     w3,          630 
        dat     w0,          226 

in      dat     0,           10 
        dat     1,           9
        dat     1,           11

;**********Adjusting BiShot***********

gSmall  mul.ab  #5,          gCount
        add.b   gCount,      sPtr
        add.b   gCount,      sPtr+1
        jmp     sOne+1,      0

;*******Adjusting Paperazor********

sStart  mul.ab  #5,          gCount
        add.ba  gCount,      pBo2
        div.ab  #400,        gCount
        mul.b   gCount,      cp
        mul.b   gCount,      nothA
        mul.b   gCount,      nothB
        mul.b   gCount,      cc

;**********Paperazor****************

tstep1  equ     251
cstep1  equ     26
nstep1  equ     468
bstep1  equ     323

        spl     1
sClc    spl     1
        spl     1

        mov     {cp,        {pBo2
pBo2    jmp     cc,         {-293

cp      spl     @cc+1,      <tstep1
        mov.i   }cp,        >cp
nothA   spl     @nothA,     <cstep1
        mov.i   }nothA,     >nothA
nothB   spl     @nothB,     <nstep1
        mov.i   }nothB,     >nothB
bomb    mov.i   #1,         <1
cc      djn     -2,         <bstep1


;**********CLP**********************

cDecoy  equ    (cCopy-191)
cDist   equ    590
cFence  equ    50
cPtr    equ    (cCopy+153)

clp     mov    {cCopy,      {cBoot
        mov    {cCopy,      {cBoot
        djn    clp,         #6
cBoot   djn.f  cCopy+191+12,<cDecoy+11

cCopy   stp    #12,         #cDist
        mov.x  *cCheck,     @cCheck
        mov    cCopy,       }cPtr
        mov    cBomb2,      }cPtr
        mov    cBomb3,      }cPtr
cCheck  sne.x  -cFence,     cFence
        jmp    -4
        mov    }cCopy,      @cCopy
        jmn.f  -1,          >cCopy
        jmp    cCopy+1+cDist,{cCheck+cDist-cFence
cBomb2  stp    #12,         #34
cBomb3  mod    3,           3

;******anti-HSA d-clear************

aGate   equ (sOne-6)

        dat    0,           0
        dat    0,           0
aHSA    spl    #0,          0
        mov    bw,          >aGate
        djn.f  -1,          >aGate
bw      dat    >1,         2-aGate

        end  gCount

