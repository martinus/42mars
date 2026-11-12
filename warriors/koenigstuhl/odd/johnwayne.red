;redcode
;name John Wayne
;author Chip Wendell
;strategy "Shoot first, and ask questions later"
;strategy Entry for Redcoders Frenzy #18
;strategy Start with a sparse bombing run,
;strategy  then find the flag and run dual Recon2
;assert CORESIZE==8000

test	djn	$0,	#0
chk2  mov	#0,	bptr		;Zero the B operand of the target
	cmp	bptr,	test		;Does it match the DJN signature?
	jmp	hit
vamp	sub	sptr,	vbomb		;Found the flag!
	mov	vbomb,	@sptr
	jmp 	clear
vbomb	jmp	@0,	scan-sptr

check	slt	#bottom-sptr, sptr	;Are we seeing ourselves?
	jmp	clear				; ... Yes - missed the flag
	add	#2,	sptr			;Adjust the scan pointer
next	mov	<sptr,	bptr
	cmp	@sptr,	bptr		;Has the target changed in one cycle?
	jmp	chk2			;...if yes, do further checks
hit	mov	sptr,	@sptr		;Not the flag. Bomb it and move on
	djn	next,	#2
	mov	#2,	-1		;Reset count for next time

;Scan for the flag
sloop	cmp	<sptr,	<sptr
	jmp	check
	cmp	<sptr,	<sptr
	jmp	check
	cmp	<sptr,	<sptr
	jmp	check
	djn	sloop,	#(CORESIZE-MAXLENGTH)/6 + 1
	jmp	clear			;Missed the flag - start a clear

;Start with a quick bombing run
bstep	equ	(557*16+1)
bloop	add	#bstep,	bptr
start	mov	bomb,	@bptr		;Do two together, so they will be
	mov	bomb,	<bptr		; invisible to the scan phase later
	djn	bloop,	#499
bptr	jmp	sloop,	test+14+bstep

;Modified Recon 2, using 88 code
step equ 6557   
bomb    dat        #-19,     #-19
        dat        #-19,     #-19
clear   spl        0,        #-19   
wipe    mov        @jump,  <ptr     
w2      mov        @jump,  <ptr     
jump    jmp        wipe,   clear           

sptr	dat	#0,	#test

loop    sub        inc,   scan
scan    cmp        step+6, step	; check a pair
        slt        scan,    #-25	; ignore self
timer   djn        loop,   #7999	; count down to DAT phase

tweak   mov        scan,    @wipe	; redirect aim of stun gun
t2      jmn        timer,   timer	; when timer expires,
        djn        <tweak, jump	; go to DAT clear mode
inc	dat	#-step,	#-step
ptr	dat	#0,	#-19

for MAXLENGTH-CURLINE
	dat	#0,	#CURLINE
rof
bottom

	end	start

