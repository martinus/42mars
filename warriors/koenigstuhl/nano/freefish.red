;redcode-nano
;name Free the Fish!
;original name Nano 1399
;author Maezumo
;assert CORESIZE==80
;evolved with -=< Maezumo >=- (1.06cs)
;evolved:21:23:26 11-04-2009
;origin Paper 26
;generation 191
;benchscore 159.38 (nanoBM07 1000 rounds)
spl.b  # 0 ,> 11
mov.i  } -1 ,} 1
spl.b  < 27 ,> 14
mov    $ 2 ,{ 75
djn.x  $ -1 ,< 46
end
