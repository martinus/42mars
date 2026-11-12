;redcode
;name Der Zweite Blitzkrieg
;author Mike Nonemacher
;strategy quick-scan -> stone-spiral -> 2-pass coreclear -> gate
;assert CORESIZE==8000

BOOT    EQU     3405                    ;Just picked this one at random
C       EQU     328                     ;bombing increment - small, mod-8
GVAL    EQU     -19                     ;decrement for gate
INCR    EQU     20                      ;offset of inc from stone
PTR     EQU     -11                     ;offset of ptr from stone+4
I       EQU     1232                    ;offset of start of spiral from imp
D       EQU     1143                    ;7-point spiral
CMP1    EQU     (start-2)*SC/2+CMPST    ;EQUs for quick-scan
CMP2    EQU     CMP1+4000
MOV1    EQU     (start-1)*SC/2+CMPST-BPTR+67
BPTR    EQU     bptr1                   ;point 67 past what we found
SC      EQU     112                     ;only 34 scans would fit :(
CMPST   EQU     start+33                ;make sure stone doesn't kill spl/jmps

start	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR	;5
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR	;10
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR	;15
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR	;20
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR	;25
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR	;30
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR
	cmp	CMP1,	CMP2
	mov	#MOV1,	BPTR	;34
bptr1   jmz     ok,     #0              ;skip if we didn't find anything
        mov     jump,   <BPTR
        mov     split,  <BPTR
        sub     #4002,  @-1
        djn     -3,     #35
ok      spl     isp                     ;launch spiral
        mov     gate,   top+BOOT-1+PTR+GVAL ;set up 2-pass clear
        mov     split,  top+BOOT-4-19
        mov     #-PTR-1,top+BOOT-1+PTR
        spl     1
        mov     -1,     0
        spl     1                       ;6 processes for bootstrap
        mov     <src,   <top
top     jmp     @0,     #BOOT+1
imp     mov     0,      D
split   spl     0,      <GVAL
stone   sub     stone+INCR, 1
        mov     <-19,   1
        jmp     -2,     <split+GVAL
        mov     @PTR,   <stone+INCR
jump    jmp     -1,     <GVAL-2
gate    dat     <GVAL-1,#0
isp     mov     imp,    imp+I
        mov     inc,    top+BOOT-4+INCR
        spl     1
        spl     1
        spl     1
        mov     -1,     0               ;generate 15 consecutive processes
src     spl     2,      #jump+1
        jmp     @0,     imp+I
        add     #D,     -1
inc     dat     #C,     #-C
END     start

