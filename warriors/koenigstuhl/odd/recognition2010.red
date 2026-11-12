;redcode-DS
;name Recognition 2010
;author Zul Nadzri
;assert 1
;strategy This is David Moore Recon2 but with decoy points for oneshots
;strategy If this is a car, I paint it with new color but technically just cannot keep the original brand name
;strategy Submitted for 1st International Corewar Programming Contest 2010

;Recon2 Start------------------------
step equ 6557   
ptr equ (scan-8)
        dat      19,  19
diff    spl  #-step, #-step
wipe    mov    diff, >ptr     ; hit 'em with SPLs
w2      mov   *wipe, >ptr     ; later, this becomes a DAT clear
        djn.a  wipe,  length

loop    sub    diff, @s2
scan    sne (step*2) - 1, (step*2) - 7   ; check a pair
        sub    diff,  scan
s2      seq   *scan, @scan    ; check another pair
        slt.a   #20,  scan    ; ignore self
timer   djn    loop, #4800    ; count down to DAT phase

length  sub.ba #0,  #-7      ; set up for SPL wipe
tweak   mov.ab @s2, @wipe
t2      jmn    *w2,  timer   ; when timer expires,
        djn.a  <tweak, {t2   ; go to DAT clear mode
;Recon2 End------------------------

spacer	dat 0,0
decoy	nop     }4334-16, 	>7220-16
	nop 	}2891-17, 	>6562-17
	nop 	}1448-18,	>5777-18
	jmp	scan,	>663-19

end decoy

