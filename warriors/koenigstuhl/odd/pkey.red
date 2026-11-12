;redcode-94
;name	P-Key
;author	G.Labarga
;assert 1
;stratey	learning switcher
;strategy	It should defeat any single switcher
;strategy	Redcoders Frenzy, round 7, Feb. 22th 2003

	STEP EQU 2667
	D_STRAT EQU 249
	D_PREV EQU 250
	D_LOS EQU D_PREV+1
	D_WIN EQU D_PREV+2
	D_TIE EQU D_PREV+3

RESULT:	LDP.B 1,#0		;<- Last round result
STRAT:	LDP.AB #D_STRAT,#0	;<- Last strategy
PREV:	LDP.AB #D_PREV,#0	;<- strategy two rounds before
	JMZ.F INIT,>RESULT
	SLT.AB #3,PREV
	JMP CHLS,<RESULT
INIT:	STP.AB #2,#D_TIE		;first round or brainwashed
	STP.AB #0,#D_WIN
	STP.AB #0,#D_LOS
	MOV #1000,STRAT

CHLS:	JMN CHWI,RESULT
	MOV.A #1,AWLT			;loss
CHWI:	SNE #1,RESULT
	JMP ACT				;win
CHTI:	SNE #2,RESULT
	MOV.A #2,AWLT			;tie

ADJ:	ADD.BA PREV,1			;Adjust what to do if W/L/T
WLT:	LDP.AB #D_PREV+1,#0
AWLT:	ADD.AB #0,WLT
	MOD.AB #3,WLT
	STP.BA WLT,WLT
ACT:	ADD.BA RESULT,1
ACTS:	LDP.AB #D_PREV+1,#0		;Switches strategy depending W/L/T
	MUL.AB #STEP,ACTS
	ADD.B ACTS,STRAT

SAVE:	STP.B RESULT,#D_PREV
	STP.B STRAT,#D_STRAT

SLCT:	SLT #STEP,STRAT			;Launch
	JMP SRC				;Cloner II
	SLT #2*STEP,STRAT
	JMP slDodger			;CLP
	JMP boot			;Frontwards

; *** comp: 61 ins; P-warrior: 39 ins. maximum *** (32)
;********************Cloner II******************** // 12 ins

SRC	  mov	 FIX,	   -1			;START *****
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

;*************************CLP******************** // 25 ins

slDodger  mov    <btDodger,{btDodger		;START *****
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
          stp.ab #0       ,#0    ;<-- can be modified during the battle
          djn.b  -1       ,-1
pincr     mov    1        ,-1
pb        dat    5093+p1-pescape,-plen
pescape   dat    0,0

;********************Frontwards************************ // 24 ins

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
boot      mov    top+5,    top+offset+5		;START *****
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

;*********************************************************

	END RESULT

