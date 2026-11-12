;redcode-94nano
;name Spambot
;author CapnStrong
;assert 1
org start
start       SPL spam, spam+1
            MOV bomb, >bomb
            DJN.f -1, >bomb
bomb        DAT #0, #20
spam        MOV 0, 1
end
