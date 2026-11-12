From corewar-l@koth.org  Tue Aug 13 03:46:33 2002
Date: Tue, 13 Aug 2002 06:36:25 -0400 (EDT)
Originator: corewar-l@koth.org
From: M Joonas Pihlaja <jpihlaja@cc.helsinki.fi>
To: Multiple recipients of list COREWAR-L <corewar-l@koth.org>
Subject: Re: GUI front ends for pMARS?
X-Listprocessor-Version: 6.0d -- ListProcessor by Anastasios Kotsikonas
X-Comment: Usenet News "rec.games.corewar"

[I sent this on Sunday to the COREWAR-L list as well, but it
appears not to accept posts for some reason.  Apologies if you
get this twice.]

On Sat, 10 Aug 2002, Dave Schulman wrote:

>     Most of the Core Wars software I've found on the net is
> quite a few years old by now; the stuff on
> http://www.koth.org/pmars/ is typically from 1996 or so. Is
> there a pMARS simulator more recent than 0.8.6?

Lukasz already mentioned the 0.9.2 source available from
sourceforge.  The difference to 0.8.6 is mainly in packaging
rather than any new features.  So, the answer is no I guess.

> Has anyone done an x86/Windows GUI version? Linux/GNOME? If
> not, would there be any interest in such a thing?

No, no, and yes!  Or rather, there are a few binaries that run on
Windows here:

www.koth.org/pmars

but they aren't what I'd call modern GUI programs.

>     I was hoping to do a Core Wars demo for an upcoming
> high-tech expo (the more visually exciting the better).

The GUI's are rather primitive and to the non-initiated the core
display is sadly uninteresting (Cool! Flashing lights! Yeah
right.).  There are a few 'warriors' that produce visual effects
(fireworks, game of life) on the display by
reading/writing/executing core cells.  Most were produced as
entries in a tournament held by Anton Marsden, and their source
should be here:

http://pauillac.inria.fr/~doligez/corewar/Anton'sTournamentRnd3.txt

but unfortunately I can't confirm that at the moment.  At the
bottom is my own attempt at producing some visual effects on a
core display (tested on Win95 pmarsv and X11 pmars).  Be sure to
read the configuration section before running it.

Not exactly what you were looking for, I'm afraid.

Regards,

Joonas

-------
;redcode-94
;name Snoopic
;author Pihlaja
;assert CORESIZE==8000 && MAXLENGTH>=300
;
; Runs with pMARS options: -l 300 -br 1000 -v 114
; or -v 113 , -v 112 or -v 111 (depending on colour choice).
load0 z for 0
	rof
	org	Main

; Must configure this before running:
WIDTH	equ	157			; Width of mars display in core cells.
					; 157 for X11, 158 for pMARSv

;--------------------------------------------------------------------------
; Possibly configure these:
;
; If you think you're missing the lower bits of Snoopy's head, try setting
; WAIT higher or set LACE=1.

LACE	equ	0			; Boolean: if set will draw lines
					; in a seemingly random order in an
					; attempt to reduce the fading effects
					; at the end of each frame.  The
					; WAIT value may then be decreased to 1
					; to get higher frame rates.

					; colour		mode required
;PLOT	equ	mov.ab	>ptr,#0		; dark green		; -v 114
;PLOT	equ	mov.ab	#0, >ptr	; green			; -v 112
PLOT	equ	djn	1, >ptr		; light green		; -v 113
;PLOT	equ	mov.ab	@ptr, >ptr	; bright green		; -v 114
;PLOT	equ	spl	>ptr		; bright blue		; -v 111

z	FOR	LACE==0
WAIT	equ	6000			; # cycles-1 to wait at end of frame
	ROF				; to avoid fading of last drawn points
					; due to pmars clearing the display.
z	FOR	LACE!=0
WAIT	equ	1
	ROF


;--------------------------------------------------------------------------
; No changes below needed.
;
	FOR	LACE==0
YSKIP	equ	1
PMOD	equ	1
	ROF

	FOR	LACE!=0
YSKIP	equ	19
PMOD	equ	YMAX
	ROF

;--------------------------------------------------------------------------
; Drawing a single line.
;
XOFS	equ	((WIDTH-XMAX)/2)	; x-offset of draw area from left.
YOFS	equ	5			; y-offset of draw area from top.
POFS	equ	(YOFS*WIDTH)		; base offset of draw pointer.
NOWHERE	equ	0			; x-coordinate of non-existent point.
SCALMAX equ	100

;; Draw_line
;
; args:
;	yptr(in)	y-coordinate of line + 1
;	xscal(in)	x-scale factor in [0,SCALMAX].
;	xofs(in)	draw x-offset
;	yofs(in)	draw y-offset

ptr:	dat	0			; draw pointer.
pofs:	dat	0			; draw pointer offset.
xofs:	dat	0			; x-offset
yofs:	dat	0			; y-offset
xscal:	dat	SCALMAX			; x-scale factor
yptr:	equ	(lineinfo-1)		; y-coordinate

lptr:	dat	0			; array of line x-coordinates.

maxscal: dat SCALMAX, SCALMAX		; constants

Draw_line:
	mov.b	@yptr,	lptr		; get line x-coords array.
	mov.ab	@yptr,	cnt		; init loop counter with #runs.
	jmz	*exit_drawline, cnt	; bail if no runs of points.

	mov.b	yofs,	pofs		; compute draw pointer offset.
	mul	#WIDTH, pofs
	add.b	xofs,	pofs
	add	#POFS,	pofs

	mov.ba	xscal,	xscal		; will be using mul.f below to scale.

rloop:	; for each run of points.
	mov.x	>lptr,	ptr		; get x-offset and length
	mul.f	xscal,	ptr		; scale x-offset and length
	 div.f	maxscal, ptr
	add.b	pofs,	ptr		; offset draw pointer

	jmn.a	run,	ptr		; scaled run length must be at least 1.
	mov.a	#1,	ptr
  run	PLOT				; draw a run of points
	djn.a	run,	ptr

cnt:	djn	rloop,	#0

exit_drawline:
	jmp	ycnt			; return to caller.


;--------------------------------------------------------------------------
; Main loop
;

phase	dat	0			; phase of sinusoid.
xwid	dat	0			; width of a line to draw.
absy	dat	0			; temp to compute |y|.
y	dat	0			; y screen coord.
x	dat	0			; x screen coord.
z	dat	0			; z-coordinate in 3-space.
i	dat	0			; line number.

Z_0	equ	110			; distance of eye from screen plane.
					; smaller = more depth perception.

Z_1	equ	20			; base offset of picture plane from
					; screen plane.
;    screen
;          \   
;           |       /
;   eye     |      (
;  /        |       \  
; e---------|--------\  
;  \_______/|\______/ \  
;     Z_0   |  Z_1     )<- modulated picture plane.
;           |         /  
;           Y

X_0	equ	XMAX/2

Main:	ldp	#123,	phase		; update phase of sinusoid each frame
	add	#9,	phase		; by this much (mod SIN_LEN).
	stp	phase,	#123

	mov	phase,	i		; choose first line to draw.
	mod	#PMOD,	i

yloop:	mod	#YMAX,	i
	mov	i,	yptr		; update data pointer for Draw_line.

	; compute z as an modulated sinusoid in i=line number.
	mov	i,	theta
;	mul	#4,	theta		; scale modulation amplitude
;	div	#3,	theta
	add.b	phase,	theta
	jmp	sin,	>theta
dunsinning:				; after sin completes, execution
	mov	theta,	z		; resumes here and theta := sin(theta).
	add	#Z_0+Z_1, z

	; project x
	mov	#Z_0*X_0, x
	div.b	z, 	x

	; compute on-screen width of line.
	mov.b	x,	xwid
	mul	#2,	xwid
	sub	#X_0,	x

	; compute y in space
	mov	i,	y
	sub	#YMAX/2,y

	; project y.
	mul	#Z_0,	y
	  ; divide signed y by unsigned z.
	mov	y,	absy		; take absolute value.
	sub.ba	absy,	absy
	slt	y,	#CORESIZE/2
	 mov.x	absy,	absy
	div.b	z,	absy		; unsigned divide.
	mov.a	#0,	absy		; re-establish sign.
	sub.ba	absy,	absy
	slt	y,	#CORESIZE/2
	 mov.x	absy,	absy

	add	#YMAX/2, absy		; update on-screen y-offset for
	mov.b	absy,	yofs		; Draw_line

	; compute xscal to make Draw_line draw a line of width = xwid.
	mov.b	xwid,	xscal
	mul	#SCALMAX, xscal
	div	#XMAX,	xscal

	; compute x-offset to centre picture for Draw_line.
	mov	#WIDTH,	xofs
	sub.b	xwid,	xofs
	div	#2,	xofs

	add	#YSKIP,	i		; choose next line to draw
	jmp	Draw_line, >yptr	; and go draw the current one.
ycnt:	djn	yloop,	#YMAX		; draw_line jump here when done.

	djn	0,	#WAIT		; wait for some time before clearing
	dat	0			; the display by suicide.

;--------------------------------------------------------------------------
; Picture data
;

XMAX EQU 75				; max x-coordinate of picture
YMAX EQU 45				; max y-coordinate of picture

; For each line record the number of runs of points on that line, and
; a pointer to the runs.
	dat	0			; must be dat 0
lineinfo:
	dat 1,	line0-lptr
	dat 1,	line1-lptr
	dat 2,	line2-lptr
	dat 2,	line3-lptr
	dat 2,	line4-lptr
	dat 2,	line5-lptr
	dat 2,	line6-lptr
	dat 2,	line7-lptr
	dat 3,	line8-lptr
	dat 3,	line9-lptr
	dat 4,	line10-lptr
	dat 5,	line11-lptr
	dat 4,	line12-lptr
	dat 4,	line13-lptr
	dat 3,	line14-lptr
	dat 2,	line15-lptr
	dat 2,	line16-lptr
	dat 2,	line17-lptr
	dat 2,	line18-lptr
	dat 2,	line19-lptr
	dat 2,	line20-lptr
	dat 2,	line21-lptr
	dat 3,	line22-lptr
	dat 2,	line23-lptr
	dat 2,	line24-lptr
	dat 2,	line25-lptr
	dat 2,	line26-lptr
	dat 2,	line27-lptr
	dat 2,	line28-lptr
	dat 2,	line29-lptr
	dat 2,	line30-lptr
	dat 2,	line31-lptr
	dat 3,	line32-lptr
	dat 3,	line33-lptr
	dat 3,	line34-lptr
	dat 3,	line35-lptr
	dat 3,	line36-lptr
	dat 4,	line37-lptr
	dat 4,	line38-lptr
	dat 3,	line39-lptr
	dat 2,	line40-lptr
	dat 1,	line41-lptr
	dat 2,	line42-lptr
	dat 2,	line43-lptr
	dat 2,	line44-lptr

; For each line, record the runs on that line as (x-offset, numpoints).
linedata:
line0:
	dat 29, 18
line1:
	dat 24, 25
line2:
	dat 20, 10
	dat 44, 6
line3:
	dat 17, 7
	dat 46, 4
line4:
	dat 14, 6
	dat 47, 3
line5:
	dat 13, 4
	dat 47, 3
line6:
	dat 11, 3
	dat 47, 3
line7:
	dat 9, 3
	dat 47, 3
line8:
	dat 8, 3
	dat 39, 4
	dat 47, 3
line9:
	dat 7, 3
	dat 36, 7
	dat 47, 2
line10:
	dat 7, 4
	dat 28, 2
	dat 34, 10
	dat 46, 3
line11:
	dat 7, 4
	dat 25, 5
	dat 32, 4
	dat 39, 6
	dat 46, 2
line12:
	dat 6, 7
	dat 22, 8
	dat 31, 3
	dat 38, 10
line13:
	dat 5, 24
	dat 31, 1
	dat 37, 7
	dat 45, 3
line14:
	dat 5, 24
	dat 37, 5
	dat 45, 4
line15:
	dat 5, 25
	dat 45, 6
line16:
	dat 5, 25
	dat 46, 8
line17:
	dat 4, 26
	dat 47, 26
line18:
	dat 3, 27
	dat 50, 24
line19:
	dat 2, 29
	dat 65, 9
line20:
	dat 1, 30
	dat 64, 11
line21:
	dat 1, 30
	dat 64, 11
line22:
	dat 0, 31
	dat 66, 5
	dat 72, 3
line23:
	dat 0, 31
	dat 72, 3
line24:
	dat 0, 31
	dat 72, 3
line25:
	dat 0, 31
	dat 73, 2
line26:
	dat 0, 31
	dat 73, 2
line27:
	dat 0, 31
	dat 73, 2
line28:
	dat 0, 31
	dat 73, 2
line29:
	dat 0, 31
	dat 72, 3
line30:
	dat 0, 31
	dat 72, 2
line31:
	dat 0, 30
	dat 71, 2
line32:
	dat 1, 28
	dat 33, 5
	dat 70, 3
line33:
	dat 2, 26
	dat 32, 8
	dat 70, 2
line34:
	dat 3, 24
	dat 33, 10
	dat 68, 3
line35:
	dat 3, 22
	dat 34, 14
	dat 67, 3
line36:
	dat 5, 21
	dat 37, 15
	dat 64, 4
line37:
	dat 9, 5
	dat 17, 2
	dat 20, 8
	dat 41, 25
line38:
	dat 15, 4
	dat 22, 9
	dat 39, 3
	dat 48, 16
line39:
	dat 14, 5
	dat 25, 10
	dat 38, 3
line40:
	dat 14, 10
	dat 27, 14
line41:
	dat 13, 27
line42:
	dat 12, 2
	dat 19, 20
line43:
	dat 10, 3
	dat 28, 10
line44:
	dat 9, 3
	dat 30, 9


;--------------------------------------------------------------------------
; Sin table
;

SIN_LEN EQU 100

; sin: compute sin
; args:
;	theta(in/out)	input: angle in 0..SIN_LEN-1 (inclusive).
;			output: approximately 20*sin( 2*PI*(angle-1)/SIN_LEN ).
; Resumes execution at the label `dunsinning'.
sin:	mod	#SIN_LEN, theta
	slt	#SIN_LEN/2, theta
	jmp	5
	  mod	#SIN_LEN/2, theta
	  add	#sintab-theta, theta
	  mov.b	@theta, theta
	jmp	*sin_exit
	  add	#sintab-theta, theta
	  mov.ab @theta, theta
sin_exit: jmp	dunsinning

theta: dat	0
sintab:
	dat	0 , 0
	dat	1 , -1
	dat	2 , -2
	dat	3 , -3
	dat	4 , -4
	dat	6 , -6
	dat	7 , -7
	dat	8 , -8
	dat	9 , -9
	dat	10 , -10
	dat	11 , -11
	dat	12 , -12
	dat	13 , -13
	dat	14 , -14
	dat	15 , -15
	dat	16 , -16
	dat	16 , -16
	dat	17 , -17
	dat	18 , -18
	dat	18 , -18
	dat	19 , -19
	dat	19 , -19
	dat	19 , -19
	dat	19 , -19
	dat	19 , -19
	dat	19 , -19
	dat	19 , -19
	dat	19 , -19
	dat	19 , -19
	dat	19 , -19
	dat	19 , -19
	dat	18 , -18
	dat	18 , -18
	dat	17 , -17
	dat	16 , -16
	dat	16 , -16
	dat	15 , -15
	dat	14 , -14
	dat	13 , -13
	dat	12 , -12
	dat	11 , -11
	dat	10 , -10
	dat	9 , -9
	dat	8 , -8
	dat	7 , -7
	dat	6 , -6
	dat	4 , -4
	dat	3 , -3
	dat	2 , -2
	dat	1 , -1
	dat	0 , 0
end


