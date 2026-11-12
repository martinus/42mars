;redcode-94nop
;name KryneLamiya
;author Nenad Tomasev
;assert CORESIZE==8000
;strategy oneshot

step equ 2005
ini equ 204

	org scan

pok	dat ini+9, ini
b	dat 1, 10
clr	spl #400, 10
	mov *b, >pok
	mov *b, >pok
	djn.f -2, }clr

	for 34
	dat 0, 0
	rof

inc	add.f more, pok
scan	seq }pok, >pok
	sne *pok, @pok
	djn.f inc, *pok
	jmp clr, <pok

	for 5
	dat 0, 0
	rof

more	dat step, step

	for MAXLENGTH-CURLINE
	dat 0, 0
	rof

	end

