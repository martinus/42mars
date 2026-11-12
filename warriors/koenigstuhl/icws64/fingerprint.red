;redcode-ICWS
;name Fingerprint
;author G.Labarga
;assert CORESIZE==8192
;strategy Stone/imp

;---stone
	step equ 3812	;mod4
	trail equ sto-400
	d1 equ 1*step+1
	sgate equ sto-10
;---clear
	cgate equ clr-7
;---pump
	pgate equ lch-8
;---boot
	sloc equ (sto+6+1200 + 1673 )
	ploc equ (sloc+6880+ (6384 *4) )
	cloc equ (ploc-400+2 +(4252*4) )
	iwhere equ -ploc+imp+4

sto:	spl 0,<sgate
ref:	mov bmb,<d1
	mov bmb,@ref
	add #2*step,@-1 ;ref
	djn ref,<trail ;jmp ref ;
bmb:	dat <sgate-sto-1,<-11 ;step+1
for 20
	dat #0
rof
start:
ssrc:	spl sec,sto+6		;s sec
csrc:	spl 1,clr+5		;s 1
psrc:	spl 1,lch+4		;m sto
	mov <psrc,<pgo		;s 1
	mov <csrc,<cgo		;m sto
	mov <ssrc,<sgo		;mclr
sgo:	jmp @0,sloc
for 10  ; was 110 [CCB]
	dat #0
rof
clr:	spl 0,<cgate
	mov cbm,<cgate
	djn -1,<cgate
	dat #0
cbm:	dat <cgate-clr-1,<cgate-clr-1
for 10  ; was 100 [CCB]
	dat #0
rof
spt:
sec:	mov <csrc,<cgo		;m pmp
	mov <ssrc,<sgo		;m pmp
	mov <ssrc,<sgo		;m pmp
cgo:	spl @0,cloc		;m clr
pgo:	spl @0,ploc
	jmn sto,<ssrc		;check
	dat <sgo,<cgo
for 10  ; was 20 [CCB]
	dat #0
rof
imp:	mov 0,3277
for 4
	mov 0,3277
rof
for 10
	dat #0
rof
lch:	spl 0,iwhere-3278
	add #3278,lch
igo:	jmp @lch,<pgate

	end start
