;redcode
;name Mr.Hide
;author Sascha Zapf
;assert CORESIZE==8000
;strategy Pure Random-Switcher
;strategy Second Entry for the Redcoder's Frenzy Round 7

b EQU 19
m EQU 3207
pcell EQU 399

select  ldp.a	#pcell,seed
	add.a	#pcell,seed
	mul.a	#b,seed
	mod.a	#m,seed
	stp.a	seed,select
	mod.a	#3,seed

seed  	jmp  @0,pSRC            ;Cloner II
	dat  #0,slDodger       ;CLP
	dat  #0,pboot           ;frontwards

pSRC
	mov.i 	seed+1,ptrap+1
	jmp	SRC
pboot   mov.i 	seed+1,ptrap+1
	jmp	boot

;********************Cloner II********************

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


end select

