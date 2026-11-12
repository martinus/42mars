;redcode
;name Quarter
;author Stefan Haenssgen
;assert CORESIZE==8192
; Copies a killer to every quater of the core, and splits into four
; processes, each one bombing its slice of memory.  Not very subtle,
; but quite powerful since the killers produce a bomb with every
; second instruction, and are difficult to hit.  The killers destroy
; each other after they have bombed through their quater, but the
; battle should be decided before this happens.  Speed is the
; important factor.
;
Z1       DAT             # 2062   ; pointer to copies, the Killers are
Z2       DAT             # 4110   ;  placed at equal distances in memory
Z3       DAT             # 6158   ;  formula: zi = i * slen / 4 + dist
                                  ;   where slen = 8192        arena size
                                  ;   and   dist = loop - z1   offset
START    MOV     KILL,   < Z2     ; copy one Killer
         MOV     LOOP,   < Z2     ;
         SPL   @ Z2               ; spawn copied Killer
         MOV     KILL,   < Z1     ; copy another Killer
         MOV     LOOP,   < Z1     ;
         SPL   @ Z1               ; spawn the second Killer
         MOV     KILL,   < Z3     ; for the third time, copy and
         MOV     LOOP,   < Z3     ;
         SPL   @ Z3               ; spawn a Killer
         JMP     LOOP             ; jump to the fourth Killer
PTR      DAT             # 0      ;
LOOP     MOV     PTR ,   < PTR    ; bomb with DAT
KILL     DJN     LOOP,     PTR    ; at every other location in the arena
         END     START



