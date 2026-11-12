;redcode
;name PointA3b
;author Lukasz Adamowski
;assert 1

	mov	$-1,	ptrap+1
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

stable	equ	10
stras	equ	27
ltable	equ	400
lasts	equ	3
zero	equ	ROUNDS/2
result	equ	ptrap+1

start	ldp.a	#0,	result
	seq.a	#-1,	result
	jmp	learn
prepare	stp	#zero,	pwhere
pwhere	djn	$-1,	#stable+stras
learn	ldp.a	#ltable,	ltmp
	stp.a	ltmp,	ltmp0
	nop	}-2,	}ltmp0
	mul.a	#3,	lwhere
ltmp	add.a	#0,	lwhere
	djn	learn,	#lasts
	add.a	#stable,	lwhere
lwhere	ldp.a	#0,	lscore
ctmp0	sne.a	#1,	result
ctmp1	add.a	#2,	lscore
ctmp2	sub.a	#1,	lscore
lscore	stp.a	#0,	lwhere
choose	ldp.a	#ltable,	ctmp
	nop	}-1,	}ptrap+1
ctmp	add.a	#0,	cwhere
	mul.a	#3,	cwhere
	djn	choose,	#lasts-1
	add.a	#stable,	cwhere
cwhere	ldp	#0,	ctmp0
	nop	}cwhere,	>cwhere
	djn	$-2,	#3
	slt	ctmp0,	ctmp1
	jmp	cskip1,	}ptrap+1
	slt	ctmp1,	ctmp2
	mov.a	#-1,	choice
	add.a	#2,	choice
	jmp	cskip2,	}ptrap+1
cskip1	slt	ctmp2,	ctmp0
	mov.a	#2,	choice
cskip2	stp.a	choice,	choose
choice	jmp	@0,	$boot
ltmp0	dat	$ltable-1,	$SRC-1
	dat	$0,	$slDodger

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

	end	start

