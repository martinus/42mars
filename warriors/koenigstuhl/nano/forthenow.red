;redcode-nano
;assert 1
;author hwm
;name for the now
;strategy oneshot (vaguely)
      seq.i  { 23, $ 18
blam1 mov.ab # 25, # 30 
      spl.ba # blam1, > 56 
blam2 mov.i  * 55, > blam1 
      djn.f  $ blam2, > blam1  
end
