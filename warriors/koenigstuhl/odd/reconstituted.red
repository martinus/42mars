;redcode-94
;name Reconstituted
;author Robert Macrae after David Moore
;strategy Kill everything or die trying
;         SNE scanner adapted from Recon 2 for various cores
;assert 1

for CORESIZE == 8000
   ; 6557 was David's unique constant, hits 3, 7, 9, and 11 point imps
   ; 3147 might do better against 3&7 pt imps but misses 9&11.
   ; 2741 is a possible alternative
   step     equ 3147
   gap      equ 7
   counter  equ 4800
rof

for CORESIZE == 55440
   ; For large core sensible steps look like 10919, 12889, maybe 37073
   ; 10919 attacks 13,17+19 pt imps, but hits at -13 after 853
   ; 12889 attacks 13,17+29 with a 50% longer run, hits at +9 after 2241
   ; 37073 attacks 13+17 with a 80% longer run, hits at +7 after 1799
   ; On balance 12889 seems a bit better vs scanners and I lose against SIs anyway
   ; scan gap increased from 6 to 7   ; *** check this
   step    equ 12889   ; Seems better than 10919
   gap     equ 7       ; Performance with 6 almost identical
   counter equ 30000   ; May be too big as saturates long before this?
rof

for CORESIZE == 800
   ; For tiny core the approach doesn't look great, maybe find another constant?
   ; Imps don't have long to launch and do not seem to be strong.
   ; 309 hits 3,7,9 and hits +1 at 189, too slow? +17 at 13 and -4 at 44 so good pattern.
   ; 127 hits 3,7,9 and hits +1 at 63 and +13 at 19.  ok with gap of 6?
   ; 283 hits 3,7 and hits +1 at 147; +11 at 17 and -5 at 65.  In-between?
   step    equ 309     ; 127 little different on average
   gap     equ 6       ; Not sure I actually tried 7?
   counter equ 480     ; Should be right ballpark now
rof

ptr     equ (scan-8)

        dat      19,  19
diff    spl  #-step, #-step
wipe    mov    diff, >ptr     ; hit 'em with SPLs
w2      mov   *wipe, >ptr     ; later, this becomes a DAT clear
        djn.a  wipe,  length

loop    sub    diff, @s2
scan    sne (step*2)-1, (step*2)-gap-1 ; check a pair
        sub    diff,  scan
s2      seq   *scan, @scan    ; check another pair
        slt.a   #20,  scan    ; ignore self
timer   djn    loop, #counter ; count down to DAT phase

for CORESIZE==800
   length  sub.ba #0,  #-7    ; set up SPL wipe 14 long
   tweak   mov.ab @s2, @wipe
rof

for CORESIZE!=800
   tweak   mov.ab @s2, @wipe  ; hope swapping doesn't break much
   length  sub.ba #0,  #-8    ; set up SPL wipe 16 long
rof

t2      jmn    *w2,  timer    ; when timer expires,
        djn.a  <tweak, {t2    ; go to DAT clear mode

        end    scan