;redcode-94
;assert 1
;       CORESIZE==6000
;name yabr2 (yet another borrowed recon 2)
;author David Houston
;strategy SNE scanner / SPL wiper

; Look at pairs of cells that are 6 apart.
; When something is found, wipe it with 14 SPLs like this:
; ..X.....X.....

step	equ	2687

;2687 * 89 = 5143


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
timer   djn    loop, #4000    ; count down to DAT phase

length  sub.ba #0,  #-7      ; set up for SPL wipe
tweak   mov.ab @s2, @wipe
t2      jmn    *w2,  timer   ; when timer expires,
        djn.a  <tweak, {t2   ; go to DAT clear mode

end scan
