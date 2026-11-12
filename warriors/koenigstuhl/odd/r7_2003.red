;redcode
;name R7 2003
;author Michal Janeczek
;strategy naive switcher
;assert 1

       org start

;********************Cloner II********************

cloner    mov   }0,        ptrap+1

SRC	  mov	 FIX,	   -1
CPY	  mov	@SRC-1,	   <DST
	  mov	<SRC-1,	   <DST
	  mov	<SRC-1,	   <DST
	  mov	<SRC-1,	   <DST
	  djn	 CPY,	   SRC-1
DST	  spl	 @DST,	   5000
HNT	  jmz	 HNT,	   <DST
	  jmp	 SRC
FIX	  dat	 0,	   12
	  dat	 0,	   0
	  dat	 0,	   1

;----- switcher

frontw equ    boot

bwash1 equ    37
bw_val equ    39
pkey   equ    41
bwash2 equ    43

start  ldp.a  #bwash1 , detect
       ldp    #bwash2 , detect
detect seq    #0      , #0
       jmp    switch
       stp    #111    , #bwash1
       stp    #117    , #bwash2
       jmp    tab-1

switch ldp.a  }0      , result
       ldp.a  #pkey   , tab
       mod.ba *result , tab
       stp    *tab    , #pkey  ; S L W T
tab    jmp    }0      , 78     ; 0 2 1 3
       stp    #cloner , #78    ; 1 2 1 3
       stp    #adjust , #11    ; 2 3 4 1
       stp    #frontw , #38    ; 3 2 3 3
       stp    #clp    , #151   ; 4 3 4 1

result stp    #0      , #4
       stp    #332    , #7
       jmp    tab+1   , 5

adjust ldp.a  #bw_val , ptrap+1
       spl    clp+1   , }ptrap+1
       stp.ab ptrap+1 , #bw_val

       for    14
       dat    0       , 0
       rof

;*************************CLP********************

clp       ldp.a  #bw_val  ,ptrap+1
          mov    #-400    ,ptrap+1

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
          stp.ab #0       ,#0    ;<-- values of the a- and b-fields can 
be modified during the battle
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

