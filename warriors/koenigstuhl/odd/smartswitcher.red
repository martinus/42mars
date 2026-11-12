;redcode-94
;name Smart Switcher?
;author John Metcalf
;strategy 4 similar copies of a simple 3-state switcher.
;strategy primary copy finds out whether the opponent brainwashes
;strategy to Cloner, CLP or Frontwards, then switches permanently
;strategy tp a copy which acts appropriately.
;assert (CORESIZE==8000)

        org    pThink

        pKey   equ 447
        front  equ boot
        cloner equ SRC-1
        clp    equ slDodger

pThink: ldp.a  #0,             #1
        ldp.a  #pKey,          pVect
        add.a  pThink,         pMod
pMod:   mod.a  #13,            pVect
        stp.b  *pVect,         #pKey

                                    ;  STATE  LOSE  WIN  TIE  COPY

pVect:  jmp    }0,             1148 ;  (0)    4     0    8    (1)
        dat    cloner,         1149 ;  (1)    5     1    9    (2)
        dat    cloner,         1150 ;  (2)    6     2    10   (3)
        dat    cloner,         1151 ;  (3)    7     3    11   (4)
        dat    clp,            1230 ;  (4)    8     12   0    (1)
        dat    clp,            61   ;  (5)    9     5    1    (2)
        dat    clp,            2012 ;  (6)    10    10   2    (3)
        dat    clp,            843  ;  (7)    11    3    3    (4)
        dat    front,          2318 ;  (8)    4     8    8    (1)
        dat    front,          2319 ;  (9)    5     9    9    (2)
        dat    front,          2320 ;  (10)   6     10   10   (3)
        dat    front,          2321 ;  (11)   7     11   11   (4)
        dat    clp,            1713 ;  (12)   10    5    3    (test)

        dat    cloner,         1148 ;  (13)   unreachable
        dat    cloner,         1148 ;  (14)   unreachable

        mov.i  #1,             ptrap+1

;********************Cloner II********************

SRC       mov    FIX,      -1
CPY       mov   @SRC-1,    <DST
          mov   <SRC-1,    <DST
          mov   <SRC-1,    <DST
          mov   <SRC-1,    <DST
          djn    CPY,      SRC-1
DST       spl    @DST,     5000
HNT       jmz    HNT,      <DST
          jmp    SRC
FIX       dat    0,        12
          dat    0,        0
          dat    0,        1

;*************************CLP********************

slDodger  mov    <btDodger,{btDodger
          mov    <btDodger,{btDodger
          mov    <btDodger,{btDodger
          mov    <btDodger,{btDodger
          mov    <btDodger,{btDodger
          djn    -4       ,#4
btDodger  jmp    pescape+300,pescape

plen      equ    (pescape-p1)

p1        mov    pb       ,@pfence
          mov    pb       ,*pfence
ploop     add    pincr    ,psnare
          mov    psnare   ,@psnare
pfence    sne    pb-46    ,pb+26
          jmp    ploop
          add    preset   ,psnare
          mov    pb       ,pescape
pcopy     mov    >pescape ,}pescape
          jmn.b  -1       ,pescape
preset    jmp    p1+5093  ,-p1-5093
psnare    jmp    ptrap-200,+200
ptrap     mod.x  #10      ,#1
          stp.ab #0       ,#0
          djn.b  -1       ,-1
pincr     mov    1        ,-1
pb        dat    5093+p1-pescape,-plen
pescape   dat    0,0

;********************Frontwards************************

offset    equ    608
step      equ    12
stream    equ    cc-806
first     equ    (cc-offset+203)
gate      equ    -50

p         dat    #first,   {first+step
          dat    #30,      {-1
          dat    #30,      {-1
cc        spl    #30,      stream-660
          dat    0,        0
          dat    0,        0
          dat    0,        0
boot      mov    top+5,    top+offset+5
    for 5
          mov    {boot,    <boot
    rof
boot2     mov    cc,       cc+offset
    for 3
          mov    {boot2,   <boot2
    rof
          jmp    x+offset
top       sub    x,        @x
x         sne    *p,       @p
          djn.f  -2,       <stream
          spl    #0,       <p
          mov    @1,       }p
          djn    -1,       <cc

          end




 
