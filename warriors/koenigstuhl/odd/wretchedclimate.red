;redcode-94
;name Wretched Climate
;author John Metcalf
;strategy use Cloner to lure the opponent into playing Frontwards
;strategy if CLP fails to brainwash the opponent into perpetually
;strategy playing Frontwards, then try another value next time...
;strategy if Cloner ties, try Frontwards for one round only.
;assert (CORESIZE==8000)

        org    pThink

        pWash  equ 65
        pKey   equ 4
        cloner equ wUpdate
        clp    equ slDodger

pThink: ldp.a  #0,             #1
        ldp.a  #pWash,         ptrap+1
        ldp.a  #pKey,          pVect
        add.a  pThink,         pMod
pMod:   mod.a  #3,             pVect
        stp.b  *pVect,         #pKey

                                    ;  STATE  LOSE  WIN  TIE

pVect:  jmp    }0,             29   ;  (0)    2     1    4
        dat    cloner,         29   ;  (1)    2     1    4
        dat    clp,            46   ;  (2)    1     2    1
        dat    cloner,         41   ;  (3)    unreachable
        dat    frontward,      2    ;  (4)    2     2    2

wUpdate:nop    >pMod+1,        }ptrap+1
        stp.ab ptrap+1,        #pWash
        mov.i  >-1,            ptrap+1

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

frontward equ    boot
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
